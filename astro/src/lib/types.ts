export interface Media {
  id: number;
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
  mime?: string;
}

export interface TermRef {
  id: number;
  name: string;
  slug: string;
  path: string;
}

export interface Summary {
  id: number;
  type: string;
  slug: string;
  path: string;
  title: string;
  date: string;
  modified: string;
  excerpt: string;
  image: Media | null;
  author: { name: string; slug: string; path: string } | null;
  terms: Record<string, TermRef[]>;
  parent: number | null;
  order: number;
  acf: Record<string, any> | null;
}

export interface Shortcode {
  tag: string;
  atts: Record<string, string>;
  content: string;
  rendered: string;
}

export interface Block {
  name: string;
  attrs: Record<string, any>;
  innerContent: (string | null)[];
  innerBlocks: Block[];
  dynamic: boolean;
  rendered: string;
  media?: Media | null;
  shortcodes?: Shortcode[];
}

export interface Seo {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: Record<string, string> | null;
  og_image: string | null;
  schema: unknown;
}

export interface CommentNode {
  id: number;
  parent: number;
  author: string;
  date: string;
  content: string;
  children: CommentNode[];
}

export interface Entry extends Summary {
  content: string;
  blocks: Block[] | null;
  seo: Seo;
  comments: { open: boolean; count: number; tree: CommentNode[] } | null;
  ancestors: { id: number; title: string; path: string }[];
  children: Summary[];
  template: string | null;
  archive: { title: string; path: string } | null;
}

export interface Site {
  name: string;
  description: string;
  url: string;
  language: string;
  timezone: string;
  date_format: string;
  logo: Media | null;
  icon: Media | null;
  show_on_front: string;
  front_page: number | null;
  posts_page: { id: number; path: string; title: string } | null;
  posts_per_page: number;
  permalink_structure: string;
  privacy_page: string | null;
  post_types: string[];
  plugins: string[];
}

export interface MenuItem {
  id: number;
  title: string;
  path: string;
  target: string | null;
  object: string;
  objectId: number;
  children: MenuItem[];
}

export interface Menus {
  locations: Record<string, string>;
  menus: Record<string, { name: string; items: MenuItem[] }>;
}

export interface Route {
  kind: 'single' | 'archive';
  archive?: 'posts' | 'type' | 'term' | 'author';
  type: string | string[];
  id?: number;
  slug?: string;
  taxonomy?: string;
  title?: string;
  path: string;
  count?: number;
  pages?: number;
}

export interface RoutesResponse {
  posts_per_page: number;
  routes: Route[];
}

export interface Term {
  id: number;
  name: string;
  slug: string;
  description: string;
  path: string;
  seo: { title: string | null; description: string | null };
  acf: Record<string, any> | null;
}
