export type AdvertisingArticle = {
  id: string;
  slug: string;
  title: string;
  card_excerpt: string;
  body_html: string;
  cover_image_url: string;
  card_image_url: string;
  author_id: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdvertisingCarouselItem = {
  id: string;
  slug: string;
  title: string;
  card_excerpt: string;
  card_image_url: string;
  published_at: string | null;
};

export type AdvertisingArticleInput = {
  title: string;
  slug: string;
  card_excerpt: string;
  body_html: string;
  cover_image_url: string;
  card_image_url: string;
  is_published: boolean;
};
