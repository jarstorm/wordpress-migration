<?php
/**
 * Plugin Name: Headless Connector
 * Description: Expone el contenido de WordPress a un frontend estático (Astro): rutas, entradas con bloques parseados, menús, ajustes, ACF, SEO y comentarios. Añade CORS para los formularios y un webhook de reconstrucción opcional. Pensado para migraciones "WordPress headless + Astro".
 * Version: 1.0.0
 * Requires PHP: 8.0
 * License: GPL-2.0-or-later
 *
 * Opciones (wp option update ...):
 *   headless_frontend_origin  Origen permitido para CORS (por defecto "*"). Ej: https://www.cliente.es
 *   headless_api_token        Si se define, los endpoints /headless/v1 exigen "Authorization: Bearer <token>".
 *   headless_build_hook       URL a la que se hace POST al publicar/actualizar contenido (Netlify, Vercel, CI...).
 *   headless_allow_comments   1 (por defecto) permite enviar comentarios anónimos por la REST API; 0 lo desactiva.
 *
 * Filtros:
 *   headless_post_types       Tipos de contenido expuestos (por defecto: los que tienen show_in_rest, salvo adjuntos).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Headless_Connector {

	const NS = 'headless/v1';

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'cors' ), 15 );
		add_action( 'transition_post_status', array( __CLASS__, 'build_hook' ), 10, 3 );
		// Permite enviar comentarios desde el frontend (quedan sujetos a la moderación habitual).
		add_filter( 'rest_allow_anonymous_comments', function ( $allow ) {
			return (bool) get_option( 'headless_allow_comments', 1 ) ? true : $allow;
		} );
	}

	/* ------------------------------------------------------------------
	 * Registro de endpoints
	 * --------------------------------------------------------------- */
	public static function routes() {
		$read = array( __CLASS__, 'can_read' );

		register_rest_route( self::NS, '/site', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'site' ),
			'permission_callback' => $read,
		) );
		register_rest_route( self::NS, '/menus', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'menus' ),
			'permission_callback' => $read,
		) );
		register_rest_route( self::NS, '/routes', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'all_routes' ),
			'permission_callback' => $read,
		) );
		register_rest_route( self::NS, '/entry/(?P<id>\d+)', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'entry' ),
			'permission_callback' => $read,
		) );
		register_rest_route( self::NS, '/list/(?P<type>[a-z0-9_\-]+)', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'list_items' ),
			'permission_callback' => $read,
		) );
		register_rest_route( self::NS, '/term/(?P<taxonomy>[a-z0-9_\-]+)/(?P<id>\d+)', array(
			'methods'             => 'GET',
			'callback'            => array( __CLASS__, 'term' ),
			'permission_callback' => $read,
		) );
	}

	public static function can_read( WP_REST_Request $request ) {
		$token = (string) get_option( 'headless_api_token', '' );
		if ( '' === $token ) {
			return true;
		}
		$auth = (string) $request->get_header( 'authorization' );
		return hash_equals( 'Bearer ' . $token, $auth );
	}

	/* ------------------------------------------------------------------
	 * CORS: permite que el frontend llame a /headless/v1 y a los
	 * formularios (Contact Form 7) desde otro dominio.
	 * --------------------------------------------------------------- */
	public static function cors() {
		remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
		add_filter( 'rest_pre_serve_request', function ( $value ) {
			$allowed = (string) get_option( 'headless_frontend_origin', '*' );
			$origin  = get_http_origin();
			if ( '*' === $allowed ) {
				header( 'Access-Control-Allow-Origin: ' . ( $origin ? esc_url_raw( $origin ) : '*' ) );
			} elseif ( $origin && in_array( $origin, array_map( 'trim', explode( ',', $allowed ) ), true ) ) {
				header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
			}
			header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
			header( 'Access-Control-Allow-Headers: Authorization, Content-Type' );
			header( 'Vary: Origin', false );
			return $value;
		} );
	}

	/* ------------------------------------------------------------------
	 * Webhook de reconstrucción del frontend
	 * --------------------------------------------------------------- */
	public static function build_hook( $new, $old, $post ) {
		$hook = (string) get_option( 'headless_build_hook', '' );
		if ( '' === $hook || wp_is_post_revision( $post ) || wp_is_post_autosave( $post ) ) {
			return;
		}
		if ( 'publish' !== $new && 'publish' !== $old ) {
			return;
		}
		if ( ! in_array( $post->post_type, self::post_types(), true ) ) {
			return;
		}
		wp_remote_post( $hook, array(
			'blocking' => false,
			'timeout'  => 2,
			'headers'  => array( 'Content-Type' => 'application/json' ),
			'body'     => wp_json_encode( array( 'post_id' => $post->ID, 'post_type' => $post->post_type, 'status' => $new ) ),
		) );
	}

	/* ------------------------------------------------------------------
	 * Utilidades
	 * --------------------------------------------------------------- */
	public static function post_types() {
		$types = array();
		foreach ( get_post_types( array( 'show_in_rest' => true ), 'objects' ) as $t ) {
			if ( in_array( $t->name, array( 'attachment', 'wp_block', 'wp_template', 'wp_template_part', 'wp_navigation', 'wp_global_styles', 'wp_font_family', 'wp_font_face', 'nav_menu_item' ), true ) ) {
				continue;
			}
			$types[] = $t->name;
		}
		return apply_filters( 'headless_post_types', $types );
	}

	/** Convierte una URL del propio WordPress en ruta relativa ("/servicios/"). */
	public static function path( $url ) {
		if ( ! $url ) {
			return null;
		}
		$home = untrailingslashit( home_url() );
		if ( 0 === strpos( $url, $home ) ) {
			$p = substr( $url, strlen( $home ) );
			return '' === $p ? '/' : $p;
		}
		return $url;
	}

	/** Enlaces internos absolutos -> relativos (deja intactos src de /wp-content/). */
	public static function relativize( $html ) {
		if ( ! $html ) {
			return $html;
		}
		$home = preg_quote( untrailingslashit( home_url() ), '#' );
		return preg_replace( '#href=(["\'])' . $home . '(/[^"\']*)?\1#', 'href=$1$2$1', $html );
	}

	public static function media( $id ) {
		$id = (int) $id;
		if ( ! $id || 'attachment' !== get_post_type( $id ) ) {
			return null;
		}
		$src = wp_get_attachment_image_src( $id, 'full' );
		if ( ! $src ) {
			$url = wp_get_attachment_url( $id );
			return $url ? array( 'id' => $id, 'url' => $url, 'mime' => get_post_mime_type( $id ) ) : null;
		}
		return array(
			'id'      => $id,
			'url'     => $src[0],
			'width'   => (int) $src[1],
			'height'  => (int) $src[2],
			'alt'     => (string) get_post_meta( $id, '_wp_attachment_image_alt', true ),
			'caption' => wp_get_attachment_caption( $id ),
			'mime'    => get_post_mime_type( $id ),
		);
	}

	/** Campos ACF con imágenes, ficheros y relaciones expandidos. */
	public static function acf( $object_id ) {
		if ( ! function_exists( 'get_field_objects' ) ) {
			return null;
		}
		$objects = get_field_objects( $object_id );
		if ( ! $objects ) {
			return null;
		}
		$out = array();
		foreach ( $objects as $name => $field ) {
			$out[ $name ] = self::acf_value( $field, $field['value'] );
		}
		return $out;
	}

	private static function acf_value( $field, $value ) {
		switch ( $field['type'] ) {
			case 'image':
			case 'file':
				$id = is_array( $value ) ? ( $value['ID'] ?? $value['id'] ?? 0 ) : ( is_numeric( $value ) ? (int) $value : attachment_url_to_postid( (string) $value ) );
				return self::media( $id );
			case 'gallery':
				return array_values( array_filter( array_map( function ( $v ) {
					return Headless_Connector::media( is_array( $v ) ? ( $v['ID'] ?? 0 ) : $v );
				}, (array) $value ) ) );
			case 'post_object':
			case 'relationship':
				$ids = is_array( $value ) ? $value : ( $value ? array( $value ) : array() );
				return array_values( array_filter( array_map( function ( $p ) {
					$p = get_post( $p );
					return $p ? array( 'id' => $p->ID, 'type' => $p->post_type, 'title' => get_the_title( $p ), 'path' => Headless_Connector::path( get_permalink( $p ) ) ) : null;
				}, $ids ) ) );
			case 'repeater':
			case 'group':
			case 'flexible_content':
				return $value; // Se devuelven tal cual; ampliar si el sitio los usa.
			default:
				return $value;
		}
	}

	/** SEO: Yoast (API "surfaces"), Rank Math o metadatos, en ese orden. */
	public static function seo_post( $post ) {
		$seo = array( 'title' => null, 'description' => null, 'canonical' => null, 'robots' => null, 'og_image' => null, 'schema' => null );
		if ( function_exists( 'YoastSEO' ) ) {
			try {
				$m                  = YoastSEO()->meta->for_post( $post->ID );
				$seo['title']       = $m->title;
				$seo['description'] = $m->description;
				$seo['canonical']   = $m->canonical;
				$seo['robots']      = is_array( $m->robots ) ? $m->robots : null;
				$seo['schema']      = $m->schema;
				$img                = $m->open_graph_images;
				if ( is_array( $img ) && $img ) {
					$first           = reset( $img );
					$seo['og_image'] = $first['url'] ?? null;
				}
			} catch ( \Throwable $e ) {
				// Yoast no disponible o versión distinta: seguimos con los metadatos.
			}
		}
		if ( ! $seo['title'] ) {
			$raw = get_post_meta( $post->ID, '_yoast_wpseo_title', true ) ?: get_post_meta( $post->ID, 'rank_math_title', true );
			if ( $raw ) {
				$seo['title'] = function_exists( 'wpseo_replace_vars' ) ? wpseo_replace_vars( $raw, $post ) : trim( preg_replace( '/%%[^%]+%%/', '', $raw ) );
			}
		}
		if ( ! $seo['description'] ) {
			$raw = get_post_meta( $post->ID, '_yoast_wpseo_metadesc', true ) ?: get_post_meta( $post->ID, 'rank_math_description', true );
			if ( $raw ) {
				$seo['description'] = function_exists( 'wpseo_replace_vars' ) ? wpseo_replace_vars( $raw, $post ) : trim( preg_replace( '/%%[^%]+%%/', '', $raw ) );
			}
		}
		return $seo;
	}

	/** Árbol de bloques: atributos, HTML estático, HTML renderizado y medios. */
	public static function blocks( $post ) {
		if ( ! has_blocks( $post->post_content ) ) {
			return null;
		}
		$GLOBALS['post'] = $post; // Algunos bloques dinámicos dependen del post global.
		setup_postdata( $post );
		$out = array();
		foreach ( parse_blocks( $post->post_content ) as $block ) {
			if ( empty( $block['blockName'] ) && '' === trim( (string) $block['innerHTML'] ) ) {
				continue;
			}
			$out[] = self::block( $block );
		}
		wp_reset_postdata();
		return $out;
	}

	private static function block( $block ) {
		$name     = $block['blockName'] ?: 'core/freeform';
		$registry = WP_Block_Type_Registry::get_instance();
		$type     = $block['blockName'] ? $registry->get_registered( $block['blockName'] ) : null;
		$dynamic  = $type && $type->is_dynamic();

		$data = array(
			'name'         => $name,
			'attrs'        => (object) $block['attrs'],
			'innerContent' => array_map( function ( $c ) {
				return null === $c ? null : Headless_Connector::relativize( $c );
			}, $block['innerContent'] ),
			'innerBlocks'  => array(),
			'dynamic'      => $dynamic,
		);

		// HTML final del bloque (incluye shortcodes y bloques dinámicos ya resueltos).
		$data['rendered'] = self::relativize( do_shortcode( render_block( $block ) ) );

		foreach ( $block['innerBlocks'] as $inner ) {
			$data['innerBlocks'][] = self::block( $inner );
		}

		// Medios referenciados por id.
		foreach ( array( 'id', 'mediaId' ) as $k ) {
			if ( ! empty( $block['attrs'][ $k ] ) && in_array( $name, array( 'core/image', 'core/cover', 'core/media-text', 'core/video', 'core/file', 'core/audio' ), true ) ) {
				$data['media'] = self::media( $block['attrs'][ $k ] );
			}
		}

		// Shortcodes: etiqueta y atributos para poder renderizarlos de forma nativa.
		if ( 'core/shortcode' === $name ) {
			$text = trim( implode( '', array_filter( $block['innerContent'], 'is_string' ) ) );
			$data['shortcodes'] = self::parse_shortcodes( $text );
		}
		return $data;
	}

	public static function parse_shortcodes( $text ) {
		$found = array();
		if ( preg_match_all( '/' . get_shortcode_regex() . '/s', $text, $m, PREG_SET_ORDER ) ) {
			foreach ( $m as $sc ) {
				$found[] = array(
					'tag'      => $sc[2],
					'atts'     => (object) ( shortcode_parse_atts( $sc[3] ) ?: array() ),
					'content'  => $sc[5],
					'rendered' => self::relativize( do_shortcode( $sc[0] ) ),
				);
			}
		}
		return $found;
	}

	public static function terms( $post ) {
		$out = array();
		foreach ( get_object_taxonomies( $post->post_type, 'objects' ) as $tax ) {
			if ( ! $tax->public ) {
				continue;
			}
			$terms = get_the_terms( $post, $tax->name );
			if ( $terms && ! is_wp_error( $terms ) ) {
				$out[ $tax->name ] = array_map( function ( $t ) {
					return array( 'id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'path' => Headless_Connector::path( get_term_link( $t ) ) );
				}, $terms );
			}
		}
		return $out;
	}

	public static function comments( $post ) {
		if ( ! post_type_supports( $post->post_type, 'comments' ) ) {
			return null;
		}
		$list = get_comments( array( 'post_id' => $post->ID, 'status' => 'approve', 'order' => 'ASC' ) );
		$map  = array();
		foreach ( $list as $c ) {
			$map[ $c->comment_ID ] = array(
				'id'       => (int) $c->comment_ID,
				'parent'   => (int) $c->comment_parent,
				'author'   => $c->comment_author,
				'date'     => mysql2date( 'c', $c->comment_date_gmt . ' +0000' ),
				'content'  => wpautop( esc_html( $c->comment_content ) ),
				'children' => array(),
			);
		}
		$tree = array();
		foreach ( $map as $id => &$c ) {
			if ( $c['parent'] && isset( $map[ $c['parent'] ] ) ) {
				$map[ $c['parent'] ]['children'][] = &$c;
			} else {
				$tree[] = &$c;
			}
		}
		unset( $c );
		return array(
			'open'  => comments_open( $post ),
			'count' => count( $list ),
			'tree'  => json_decode( wp_json_encode( $tree ), true ),
		);
	}

	/** Resumen de una entrada (para listados). */
	public static function summary( $post ) {
		$author = get_userdata( $post->post_author );
		return array(
			'id'       => $post->ID,
			'type'     => $post->post_type,
			'slug'     => $post->post_name,
			'path'     => self::path( get_permalink( $post ) ),
			'title'    => html_entity_decode( get_the_title( $post ), ENT_QUOTES, 'UTF-8' ),
			'date'     => get_post_time( 'c', true, $post ),
			'modified' => get_post_modified_time( 'c', true, $post ),
			'excerpt'  => html_entity_decode( wp_strip_all_tags( get_the_excerpt( $post ) ), ENT_QUOTES, 'UTF-8' ),
			'image'    => self::media( get_post_thumbnail_id( $post ) ),
			'author'   => $author ? array( 'name' => $author->display_name, 'slug' => $author->user_nicename, 'path' => self::path( get_author_posts_url( $author->ID ) ) ) : null,
			'terms'    => self::terms( $post ),
			'parent'   => $post->post_parent ?: null,
			'order'    => (int) $post->menu_order,
			'acf'      => self::acf( $post->ID ),
		);
	}

	/* ------------------------------------------------------------------
	 * Endpoints
	 * --------------------------------------------------------------- */
	public static function site() {
		$logo_id = (int) get_theme_mod( 'custom_logo' );
		$front   = (int) get_option( 'page_on_front' );
		$blog    = (int) get_option( 'page_for_posts' );
		return array(
			'name'                => html_entity_decode( get_bloginfo( 'name' ), ENT_QUOTES, 'UTF-8' ),
			'description'         => html_entity_decode( get_bloginfo( 'description' ), ENT_QUOTES, 'UTF-8' ),
			'url'                 => home_url( '/' ),
			'language'            => get_bloginfo( 'language' ),
			'timezone'            => wp_timezone_string(),
			'date_format'         => get_option( 'date_format' ),
			'logo'                => self::media( $logo_id ),
			'icon'                => self::media( (int) get_option( 'site_icon' ) ),
			'show_on_front'       => get_option( 'show_on_front' ),
			'front_page'          => $front ?: null,
			'posts_page'          => $blog ? array( 'id' => $blog, 'path' => self::path( get_permalink( $blog ) ), 'title' => get_the_title( $blog ) ) : null,
			'posts_per_page'      => (int) get_option( 'posts_per_page' ),
			'permalink_structure' => get_option( 'permalink_structure' ),
			'privacy_page'        => ( $pp = (int) get_option( 'wp_page_for_privacy_policy' ) ) ? self::path( get_permalink( $pp ) ) : null,
			'post_types'          => self::post_types(),
			'plugins'             => array_values( array_map( function ( $p ) {
				return dirname( $p ) === '.' ? basename( $p, '.php' ) : dirname( $p );
			}, (array) get_option( 'active_plugins', array() ) ) ),
		);
	}

	public static function menus() {
		$out       = array( 'locations' => array(), 'menus' => array() );
		$locations = get_nav_menu_locations();
		foreach ( wp_get_nav_menus() as $menu ) {
			$items = wp_get_nav_menu_items( $menu->term_id ) ?: array();
			$nodes = array();
			foreach ( $items as $it ) {
				$nodes[ $it->ID ] = array(
					'id'       => $it->ID,
					'title'    => html_entity_decode( $it->title, ENT_QUOTES, 'UTF-8' ),
					'path'     => self::path( $it->url ),
					'target'   => $it->target ?: null,
					'parent'   => (int) $it->menu_item_parent,
					'object'   => $it->object,
					'objectId' => (int) $it->object_id,
					'children' => array(),
				);
			}
			$tree = array();
			foreach ( $nodes as $id => &$n ) {
				if ( $n['parent'] && isset( $nodes[ $n['parent'] ] ) ) {
					$nodes[ $n['parent'] ]['children'][] = &$n;
				} else {
					$tree[] = &$n;
				}
			}
			unset( $n );
			$out['menus'][ $menu->slug ] = array( 'name' => $menu->name, 'items' => json_decode( wp_json_encode( $tree ), true ) );
		}
		foreach ( $locations as $loc => $menu_id ) {
			$menu = wp_get_nav_menu_object( $menu_id );
			if ( $menu ) {
				$out['locations'][ $loc ] = $menu->slug;
			}
		}
		return $out;
	}

	/** Todas las URLs públicas del sitio, para generar las páginas estáticas. */
	public static function all_routes() {
		$routes = array();
		$front  = (int) get_option( 'page_on_front' );
		$blog   = (int) get_option( 'page_for_posts' );
		$ppp    = max( 1, (int) get_option( 'posts_per_page' ) );

		foreach ( self::post_types() as $type ) {
			$obj = get_post_type_object( $type );
			if ( ! is_post_type_viewable( $obj ) ) {
				continue;
			}
			$ids = get_posts( array( 'post_type' => $type, 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids', 'orderby' => 'ID', 'order' => 'ASC' ) );
			foreach ( $ids as $id ) {
				if ( $id === $blog ) {
					continue; // La página de entradas se trata como archivo.
				}
				$routes[] = array(
					'kind' => 'single',
					'type' => $type,
					'id'   => $id,
					'path' => $id === $front ? '/' : self::path( get_permalink( $id ) ),
				);
			}
			$count = count( $ids );
			if ( 'post' === $type && $blog ) {
				$routes[] = array( 'kind' => 'archive', 'archive' => 'posts', 'type' => 'post', 'path' => self::path( get_permalink( $blog ) ), 'title' => get_the_title( $blog ), 'id' => $blog, 'count' => $count, 'pages' => (int) ceil( $count / $ppp ) );
			}
			if ( $obj->has_archive ) {
				$routes[] = array( 'kind' => 'archive', 'archive' => 'type', 'type' => $type, 'path' => self::path( get_post_type_archive_link( $type ) ), 'title' => $obj->labels->name, 'count' => $count, 'pages' => (int) ceil( $count / $ppp ) );
			}
		}

		foreach ( get_taxonomies( array( 'public' => true ), 'objects' ) as $tax ) {
			if ( 'post_format' === $tax->name ) {
				continue;
			}
			foreach ( get_terms( array( 'taxonomy' => $tax->name, 'hide_empty' => true ) ) as $term ) {
				$routes[] = array( 'kind' => 'archive', 'archive' => 'term', 'taxonomy' => $tax->name, 'type' => $tax->object_type, 'id' => $term->term_id, 'slug' => $term->slug, 'title' => $term->name, 'path' => self::path( get_term_link( $term ) ), 'count' => (int) $term->count, 'pages' => (int) ceil( $term->count / $ppp ) );
			}
		}

		foreach ( get_users( array( 'has_published_posts' => array( 'post' ) ) ) as $user ) {
			$count    = (int) count_user_posts( $user->ID, 'post', true );
			$routes[] = array( 'kind' => 'archive', 'archive' => 'author', 'type' => 'post', 'id' => $user->ID, 'slug' => $user->user_nicename, 'title' => $user->display_name, 'path' => self::path( get_author_posts_url( $user->ID ) ), 'count' => $count, 'pages' => (int) ceil( $count / $ppp ) );
		}

		return array( 'posts_per_page' => $ppp, 'routes' => $routes );
	}

	public static function entry( WP_REST_Request $request ) {
		$post = get_post( (int) $request['id'] );
		if ( ! $post || 'publish' !== $post->post_status || ! in_array( $post->post_type, self::post_types(), true ) ) {
			return new WP_Error( 'not_found', 'No encontrado', array( 'status' => 404 ) );
		}
		$data = self::summary( $post );
		setup_postdata( $GLOBALS['post'] = $post );
		$data['content'] = self::relativize( apply_filters( 'the_content', $post->post_content ) );
		wp_reset_postdata();
		$data['blocks']    = self::blocks( $post );
		$data['seo']       = self::seo_post( $post );
		$data['comments']  = self::comments( $post );
		$data['ancestors'] = array_map( function ( $id ) {
			return array( 'id' => $id, 'title' => get_the_title( $id ), 'path' => Headless_Connector::path( get_permalink( $id ) ) );
		}, array_reverse( get_post_ancestors( $post ) ) );
		$data['children']  = is_post_type_hierarchical( $post->post_type ) ? array_map( array( __CLASS__, 'summary' ), get_children( array( 'post_parent' => $post->ID, 'post_type' => $post->post_type, 'post_status' => 'publish', 'orderby' => 'menu_order', 'order' => 'ASC' ) ) ) : array();
		$data['children']  = array_values( $data['children'] );
		$data['template']  = get_page_template_slug( $post ) ?: null;
		// Archivo al que pertenece (para migas de pan): blog para entradas, archivo del tipo para CPT.
		$obj             = get_post_type_object( $post->post_type );
		$blog            = (int) get_option( 'page_for_posts' );
		$data['archive'] = null;
		if ( 'post' === $post->post_type && $blog ) {
			$data['archive'] = array( 'title' => get_the_title( $blog ), 'path' => self::path( get_permalink( $blog ) ) );
		} elseif ( $obj && $obj->has_archive ) {
			$data['archive'] = array( 'title' => $obj->labels->name, 'path' => self::path( get_post_type_archive_link( $post->post_type ) ) );
		}
		return $data;
	}

	public static function list_items( WP_REST_Request $request ) {
		$type = sanitize_key( $request['type'] );
		if ( ! in_array( $type, self::post_types(), true ) ) {
			return new WP_Error( 'not_found', 'Tipo no disponible', array( 'status' => 404 ) );
		}
		$args = array(
			'post_type'   => $type,
			'post_status' => 'publish',
			'numberposts' => -1,
			'orderby'     => is_post_type_hierarchical( $type ) || post_type_supports( $type, 'page-attributes' ) ? array( 'menu_order' => 'ASC', 'title' => 'ASC' ) : array( 'date' => 'DESC' ),
		);
		if ( $request['taxonomy'] && $request['term'] ) {
			$args['tax_query'] = array( array( 'taxonomy' => sanitize_key( $request['taxonomy'] ), 'field' => 'term_id', 'terms' => (int) $request['term'] ) );
		}
		if ( $request['author'] ) {
			$args['author'] = (int) $request['author'];
		}
		return array_map( array( __CLASS__, 'summary' ), get_posts( $args ) );
	}

	public static function term( WP_REST_Request $request ) {
		$term = get_term( (int) $request['id'], sanitize_key( $request['taxonomy'] ) );
		if ( ! $term || is_wp_error( $term ) ) {
			return new WP_Error( 'not_found', 'No encontrado', array( 'status' => 404 ) );
		}
		$seo = array( 'title' => null, 'description' => $term->description ?: null );
		if ( function_exists( 'YoastSEO' ) ) {
			try {
				$m                  = YoastSEO()->meta->for_term( $term->term_id );
				$seo['title']       = $m->title;
				$seo['description'] = $m->description ?: $seo['description'];
			} catch ( \Throwable $e ) {
				unset( $e );
			}
		}
		return array(
			'id'          => $term->term_id,
			'name'        => $term->name,
			'slug'        => $term->slug,
			'description' => $term->description,
			'path'        => self::path( get_term_link( $term ) ),
			'seo'         => $seo,
			'acf'         => function_exists( 'get_fields' ) ? self::acf( $term ) : null,
		);
	}
}

Headless_Connector::init();
