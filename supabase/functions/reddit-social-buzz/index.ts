import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedditPost {
  id: string;
  title: string;
  url: string;
  content: string;
  author: string;
  created: number;
  thumbnail?: string;
  mediaUrl?: string;
  upvotes?: number;
}

// Parse RSS XML to extract posts
function parseRSS(xmlText: string): RedditPost[] {
  const posts: RedditPost[] = [];
  
  // Extract entries from RSS
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = entryRegex.exec(xmlText)) !== null) {
    const entry = match[1];
    
    // Extract fields
    const idMatch = /<id>([^<]+)<\/id>/.exec(entry);
    const titleMatch = /<title>([^<]+)<\/title>/.exec(entry);
    const linkMatch = /<link href="([^"]+)"/.exec(entry);
    const contentMatch = /<content[^>]*>([\s\S]*?)<\/content>/.exec(entry);
    const authorMatch = /<name>\/u\/([^<]+)<\/name>/.exec(entry);
    const updatedMatch = /<updated>([^<]+)<\/updated>/.exec(entry);
    
    if (idMatch && titleMatch) {
      const content = contentMatch ? contentMatch[1] : '';
      const decodedContent = decodeHTMLEntities(content);
      
      // Extract media URL from content - improved detection
      let mediaUrl = '';
      let thumbnail = '';
      
      // Check for i.redd.it images (most common for Reddit images)
      const iRedditMatch = /href="(https?:\/\/i\.redd\.it\/[^"]+)"/i.exec(decodedContent);
      
      // Check for preview.redd.it images (previews/thumbnails)
      const previewMatch = /href="(https?:\/\/preview\.redd\.it\/[^"]+)"/i.exec(decodedContent) ||
                          /src="(https?:\/\/preview\.redd\.it\/[^"]+)"/i.exec(decodedContent);
      
      // Check for external images (imgur, etc.)
      const imgMatch = /href="(https?:\/\/(?:i\.)?imgur\.com\/[^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i.exec(decodedContent) ||
                      /href="([^"]+\.(jpg|jpeg|png|gif|webp)(?:\?[^"]*)?)"/i.exec(decodedContent);
      
      // Check for videos
      const videoMatch = /href="(https?:\/\/v\.redd\.it\/[^"]+)"/i.exec(decodedContent) ||
                        /href="([^"]+\.(mp4|webm)[^"]*)"/i.exec(decodedContent);
      
      // Check for img src directly
      const imgSrcMatch = /src="(https?:\/\/[^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i.exec(decodedContent);
      
      // Prioritize: video > i.redd.it > imgur > other images > preview
      if (videoMatch) {
        mediaUrl = videoMatch[1];
      } else if (iRedditMatch) {
        mediaUrl = iRedditMatch[1];
      } else if (imgMatch) {
        mediaUrl = imgMatch[1];
      } else if (imgSrcMatch) {
        mediaUrl = imgSrcMatch[1];
      } else if (previewMatch) {
        // Use preview as thumbnail if no main media
        thumbnail = previewMatch[1];
      }

      // Normalize reddit hosted videos to a direct MP4 URL for inline playback.
      // Reddit uses DASH streams which have CORS issues. We proxy through our edge function.
      if (mediaUrl && /^https?:\/\/v\.redd\.it\/[^/]+\/?$/i.test(mediaUrl)) {
        // Build direct MP4 URL first
        const directUrl = `${mediaUrl.replace(/\/$/, '')}/DASH_480.mp4?source=fallback`;
        // Proxy through our edge function to bypass CORS
        mediaUrl = `https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/proxy-reddit-video?url=${encodeURIComponent(directUrl)}`;
      }
      
      // Also handle v.redd.it URLs that already have paths but no MP4 extension
      if (mediaUrl && /^https?:\/\/v\.redd\.it\/[^/]+\/(?!DASH_)[^.]*$/i.test(mediaUrl)) {
        const directUrl = `${mediaUrl.replace(/\/$/, '')}/DASH_480.mp4?source=fallback`;
        mediaUrl = `https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/proxy-reddit-video?url=${encodeURIComponent(directUrl)}`;
      }
      
      // Handle v.redd.it URLs that already have DASH paths - also proxy them
      if (mediaUrl && /^https?:\/\/v\.redd\.it\/.+\.mp4/i.test(mediaUrl)) {
        mediaUrl = `https://dejuwyeypiggvlyfliap.supabase.co/functions/v1/proxy-reddit-video?url=${encodeURIComponent(mediaUrl)}`;
      }
      
      // Also check for thumbnail separately
      if (!thumbnail && previewMatch) {
        thumbnail = previewMatch[1];
      }
      
      // Extract post ID from reddit ID format
      const postId = idMatch[1].split('/').pop() || idMatch[1];
      
      console.log(`📷 Post ${postId} media: ${mediaUrl || thumbnail || 'none'}`);
      
      posts.push({
        id: postId,
        title: decodeHTMLEntities(titleMatch[1]),
        url: linkMatch ? linkMatch[1] : '',
        content: decodeHTMLEntities(content.replace(/<[^>]*>/g, ' ').substring(0, 500)),
        author: authorMatch ? authorMatch[1] : 'unknown',
        created: updatedMatch ? new Date(updatedMatch[1]).getTime() : Date.now(),
        mediaUrl: mediaUrl || thumbnail, // Use thumbnail as fallback
        thumbnail,
      });
    }
  }
  
  return posts;
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Filter for relevant posts (player news, social reactions, etc.)
function isRelevantPost(post: RedditPost): boolean {
  const title = post.title.toLowerCase();
  const content = post.content.toLowerCase();
  const combined = title + ' ' + content;
  
  // Keywords that indicate social buzz / player content
  const relevantKeywords = [
    'tweet', 'twitter', 'ig', 'instagram', 'post', 'story', 'stories',
    'quote', 'said', 'says', 'reaction', 'responds', 'interview',
    'breaking', 'news', 'update', 'report', 'according to',
    'just', 'dropped', 'posted', 'shares', 'announces',
    'video', 'clip', 'highlight', 'mic', 'locker room',
    'contract', 'trade', 'signing', 'injury', 'return',
    'practice', 'training camp', 'rookie', 'draft'
  ];
  
  // Exclude low-value posts
  const excludeKeywords = [
    'game thread', 'post game', 'pre game', 'weekly thread',
    'meme', 'shitpost', 'wallpaper', 'desktop', 'lock screen',
    'fantasy', 'start sit', 'waiver', 'pick up',
    'ticket', 'selling', 'buying', 'meetup'
  ];
  
  // Check for exclusions first
  if (excludeKeywords.some(kw => combined.includes(kw))) {
    return false;
  }
  
  // Has media is a strong signal
  const hasMedia = !!post.mediaUrl;
  
  // Check for relevant keywords
  const hasRelevantKeyword = relevantKeywords.some(kw => combined.includes(kw));
  
  return hasMedia || hasRelevantKeyword;
}

// Generate a curated caption using simple templates
function generateCaption(post: RedditPost, teamName: string, includeSource: boolean = true): string {
  const title = post.title;
  const emojis = ['🔥', '👀', '📰', '🏈', '💪', '🗣️', '📱', '⚡'];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  // Create engaging caption - shorter for media posts
  const maxLen = post.mediaUrl ? 80 : 100;
  const truncatedTitle = title.length > maxLen ? title.substring(0, maxLen) + '...' : title;
  
  let caption = '';
  
  if (title.toLowerCase().includes('tweet') || title.toLowerCase().includes('twitter')) {
    caption = `${randomEmoji} ${teamName} fan buzz: "${truncatedTitle}"`;
  } else if (title.toLowerCase().includes('video') || title.toLowerCase().includes('clip')) {
    caption = `🎬 ${teamName}: "${truncatedTitle}"`;
  } else if (title.toLowerCase().includes('breaking') || title.toLowerCase().includes('news')) {
    caption = `📢 ${teamName} News: "${truncatedTitle}"`;
  } else {
    caption = `${randomEmoji} From r/${teamName}: "${truncatedTitle}"`;
  }
  
  // Add clean source link at the end
  if (includeSource && post.url) {
    caption += `\n\n🔗 [Source](${post.url})`;
  }
  
  return caption;
}

// Create hash of content for deduplication
function createContentHash(title: string, url: string): string {
  const str = (title + url).toLowerCase().replace(/[^a-z0-9]/g, '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🔄 Reddit Social Buzz - Starting fetch...');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get all active team subreddit mappings
    const { data: teamSubs, error: subsError } = await supabase
      .from('team_subreddits')
      .select('*, teams(id, name, city)')
      .eq('is_active', true);

    if (subsError) throw subsError;
    
    if (!teamSubs || teamSubs.length === 0) {
      console.log('📭 No active team subreddits configured');
      return new Response(JSON.stringify({ success: true, message: 'No teams configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📡 Processing ${teamSubs.length} team subreddits...`);

    const results = [];

    for (const teamSub of teamSubs) {
      const teamId = teamSub.team_id;
      const teamName = teamSub.teams?.name || 'Team';
      const rssUrl = teamSub.rss_url;
      
      console.log(`\n🏈 Processing: ${teamName} (r/${teamSub.subreddit_name})`);

      try {
        // Fetch RSS feed
        const rssResponse = await fetch(rssUrl, {
          headers: {
            'User-Agent': 'SideHuddleSports/1.0 (Sports Fan App)'
          }
        });

        if (!rssResponse.ok) {
          console.error(`❌ Failed to fetch RSS for ${teamName}: ${rssResponse.status}`);
          continue;
        }

        const rssText = await rssResponse.text();
        const posts = parseRSS(rssText);
        console.log(`📄 Found ${posts.length} posts in RSS feed`);

        // Filter for relevant posts
        const relevantPosts = posts.filter(isRelevantPost);
        console.log(`✨ ${relevantPosts.length} posts are relevant`);

        // Get ALL huddles for this team (official + private user huddles)
        const { data: huddles } = await supabase
          .from('huddles')
          .select('id, name, is_official_team_huddle')
          .eq('team_id', teamId);

        if (!huddles || huddles.length === 0) {
          console.log(`⚠️ No huddles found for ${teamName}`);
          continue;
        }

        console.log(`📢 Found ${huddles.length} huddles for ${teamName}`);

        // Track posts added across all huddles for this team
        let totalPostsAdded = 0;
        const today = new Date().toISOString().split('T')[0];

        // Process each relevant post once per team (dedup at team level)
        for (const post of relevantPosts.slice(0, 5)) {
          const contentHash = createContentHash(post.title, post.url);

          // Check if already posted to this team (last 48 hours)
          const { data: existingPost } = await supabase
            .from('reddit_posts_log')
            .select('id')
            .eq('team_id', teamId)
            .eq('reddit_post_id', post.id)
            .single();

          if (existingPost) {
            console.log(`⏭️ Skipping duplicate: ${post.id}`);
            continue;
          }

          // Check content hash for similar posts
          const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
          const { data: similarPost } = await supabase
            .from('reddit_posts_log')
            .select('id')
            .eq('team_id', teamId)
            .eq('content_hash', contentHash)
            .gte('created_at', cutoffTime)
            .single();

          if (similarPost) {
            console.log(`⏭️ Skipping similar content: ${post.title.substring(0, 30)}...`);
            continue;
          }

          // Get or create system user for bot messages
          const { data: systemUserId } = await supabase.rpc('get_or_create_system_user');

          // Generate curated caption (includes source link)
          const messageContent = generateCaption(post, teamName, true);

          // Prepare base message data
          const baseMessageData: Record<string, unknown> = {
            user_id: systemUserId,
            content: messageContent,
            is_bot_message: true,
            message_type: 'social_buzz'
          };

          // Add media if available
          if (post.mediaUrl) {
            const isVideo = post.mediaUrl.includes('v.redd.it') || 
                           post.mediaUrl.includes('proxy-reddit-video') ||
                           post.mediaUrl.endsWith('.mp4') || 
                           post.mediaUrl.endsWith('.webm');
            baseMessageData.media_url = post.mediaUrl;
            baseMessageData.media_type = isVideo ? 'video' : 'image';
          }

          // Post to ALL huddles for this team
          let postedToAny = false;
          for (const huddle of huddles) {
            // Check daily limit per huddle
            const { data: dailyCount } = await supabase
              .from('reddit_daily_counts')
              .select('post_count')
              .eq('huddle_id', huddle.id)
              .eq('post_date', today)
              .single();

            const currentCount = dailyCount?.post_count || 0;
            const maxDaily = 5;
            
            if (currentCount >= maxDaily) {
              console.log(`📊 Daily limit reached for huddle ${huddle.name} (${currentCount}/${maxDaily})`);
              continue;
            }

            // Insert message to this huddle
            const { error: msgError } = await supabase
              .from('huddle_messages')
              .insert({
                ...baseMessageData,
                huddle_id: huddle.id
              });

            if (msgError) {
              console.error(`❌ Failed to post to ${huddle.name}: ${msgError.message}`);
              continue;
            }

            // Update daily count for this huddle
            await supabase
              .from('reddit_daily_counts')
              .upsert({
                huddle_id: huddle.id,
                post_date: today,
                post_count: currentCount + 1
              }, { onConflict: 'huddle_id,post_date' });

            console.log(`✅ Posted to ${huddle.name}: ${post.title.substring(0, 40)}...`);
            postedToAny = true;
          }

          // Only log the post once per team (not per huddle)
          if (postedToAny) {
            await supabase
              .from('reddit_posts_log')
              .insert({
                team_id: teamId,
                reddit_post_id: post.id,
                title: post.title,
                url: post.url,
                content_hash: contentHash
              });
            totalPostsAdded++;
          }
        }

        results.push({
          team: teamName,
          postsAdded: totalPostsAdded,
          huddlesTargeted: huddles.length,
          totalProcessed: relevantPosts.length,
          status: 'processed'
        });

      } catch (teamError) {
        console.error(`❌ Error processing ${teamName}:`, teamError);
        results.push({
          team: teamName,
          postsAdded: 0,
          totalProcessed: 0,
          status: 'error',
          error: teamError.message
        });
      }
    }

    console.log('\n📊 Summary:', results);

    // Calculate totals for response
    const teamsProcessed = results.length;
    const totalPosts = results.reduce((sum, r) => sum + (r.postsAdded || 0), 0);
    const teamsAtLimit = results.filter(r => r.status === 'daily_limit_reached').length;

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      teams_processed: teamsProcessed,
      total_posts: totalPosts,
      teams_at_daily_limit: teamsAtLimit,
      processedAt: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Reddit Social Buzz Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
