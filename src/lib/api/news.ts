import { supabase } from './supabase';
import { parseNews, type NewsItem } from '../newsData';

/** News from Vilarci in this language (English where there's none). Works signed out. */
export async function fetchNews(locale: string): Promise<NewsItem[]> {
  const { data, error } = await supabase.rpc('app_news', { p_locale: locale, p_limit: 30 });
  if (error) throw error;
  return parseNews(data);
}
