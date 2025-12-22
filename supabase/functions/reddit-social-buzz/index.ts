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
      
      // Extract media URL from content if present
      let mediaUrl = '';
      const imgMatch = /href="([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i.exec(content);
      const videoMatch = /href="([^"]+v\.redd\.it[^"]*)"/.exec(content) ||
                         /href="([^"]+\.(mp4|webm)[^"]*)"/i.exec(content);
      
      if (videoMatch) {
        mediaUrl = videoMatch[1];
      } else if (imgMatch) {
        mediaUrl = imgMatch[1];
      }
      
      // Extract post ID from reddit ID format
      const postId = idMatch[1].split('/').pop() || idMatch[1];
      
      posts.push({
        id: postId,
        title: decodeHTMLEntities(titleMatch[1]),
        url: linkMatch ? linkMatch[1] : '',
        content: decodeHTMLEntities(content.replace(/<[^>]*>/g, ' ').substring(0, 500)),
        author: authorMatch ? authorMatch[1] : 'unknown',
        created: updatedMatch ? new Date(updatedMatch[1]).getTime() : Date.now(),
        mediaUrl,
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
function generateCaption(post: RedditPost, teamName: string): string {
  const title = post.title;
  const emojis = ['🔥', '👀', '📰', '🏈', '💪', '🗣️', '📱', '⚡'];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  
  // Create engaging caption
  let caption = '';
  
  if (title.toLowerCase().includes('tweet') || title.toLowerCase().includes('twitter')) {
    caption = `${randomEmoji} ${teamName} fan buzz on X: "${title.substring(0, 100)}${title.length > 100 ? '...' : ''}"`;
  } else if (title.toLowerCase().includes('video') || title.toLowerCase().includes('clip')) {
    caption = `🎬 Check this out ${teamName} fans: "${title.substring(0, 100)}${title.length > 100 ? '...' : ''}"`;
  } else if (title.toLowerCase().includes('breaking') || title.toLowerCase().includes('news')) {
    caption = `📢 ${teamName} News Alert: "${title.substring(0, 100)}${title.length > 100 ? '...' : ''}"`;
  } else {
    caption = `${randomEmoji} From the ${teamName} community: "${title.substring(0, 100)}${title.length > 100 ? '...' : ''}"`;
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

        // Get official huddle for this team
        const { data: huddle } = await supabase
          .from('huddles')
          .select('id')
          .eq('team_id', teamId)
          .eq('is_official_team_huddle', true)
          .single();

        if (!huddle) {
          console.log(`⚠️ No official huddle found for ${teamName}`);
          continue;
        }

        const huddleId = huddle.id;

        // Check today's post count
        const today = new Date().toISOString().split('T')[0];
        const { data: dailyCount } = await supabase
          .from('reddit_daily_counts')
          .select('post_count')
          .eq('huddle_id', huddleId)
          .eq('post_date', today)
          .single();

        const currentCount = dailyCount?.post_count || 0;
        const maxDaily = 5;
        
        if (currentCount >= maxDaily) {
          console.log(`📊 Daily limit reached for ${teamName} (${currentCount}/${maxDaily})`);
          continue;
        }

        const remainingSlots = maxDaily - currentCount;
        let postsAdded = 0;

        // Process top relevant posts
        for (const post of relevantPosts.slice(0, remainingSlots)) {
          const contentHash = createContentHash(post.title, post.url);

          // Check if already posted (last 48 hours)
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

          // Generate curated caption
          const caption = generateCaption(post, teamName);
          
          // Build message content
          let messageContent = caption;
          if (post.url) {
            messageContent += `\n\n🔗 Source: ${post.url}`;
          }

          // Prepare message data
          const messageData: Record<string, unknown> = {
            huddle_id: huddleId,
            user_id: systemUserId,
            content: messageContent,
            is_bot_message: true,
            message_type: 'social_buzz'
          };

          // Add media if available
          if (post.mediaUrl) {
            // Determine media type
            const isVideo = post.mediaUrl.includes('v.redd.it') || 
                           post.mediaUrl.endsWith('.mp4') || 
                           post.mediaUrl.endsWith('.webm');
            messageData.media_url = post.mediaUrl;
            messageData.media_type = isVideo ? 'video' : 'image';
          }

          // Insert message
          const { error: msgError } = await supabase
            .from('huddle_messages')
            .insert(messageData);

          if (msgError) {
            console.error(`❌ Failed to post message: ${msgError.message}`);
            continue;
          }

          // Log the post
          await supabase
            .from('reddit_posts_log')
            .insert({
              team_id: teamId,
              reddit_post_id: post.id,
              title: post.title,
              url: post.url,
              content_hash: contentHash
            });

          // Update daily count
          await supabase
            .from('reddit_daily_counts')
            .upsert({
              huddle_id: huddleId,
              post_date: today,
              post_count: currentCount + postsAdded + 1
            }, { onConflict: 'huddle_id,post_date' });

          postsAdded++;
          console.log(`✅ Posted: ${post.title.substring(0, 50)}...`);
        }

        results.push({
          team: teamName,
          postsAdded,
          totalProcessed: relevantPosts.length
        });

      } catch (teamError) {
        console.error(`❌ Error processing ${teamName}:`, teamError);
        results.push({
          team: teamName,
          error: teamError.message
        });
      }
    }

    console.log('\n📊 Summary:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
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
