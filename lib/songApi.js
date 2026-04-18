import axios from 'axios';

const BASE = 'https://apis.xwolf.space';
const TIMEOUT = 30000;

const http = axios.create({
  baseURL: BASE,
  timeout: TIMEOUT,
  headers: { 'User-Agent': 'Mozilla/5.0' }
});

// Extract YouTube video ID from URL or bare ID
export function extractVideoId(input) {
  if (!input) return null;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();
  return null;
}

// Search YouTube for a song name
export async function search(query) {
  const res = await http.get('/api/search', { params: { q: query } });
  if (!res.data?.success) throw new Error(res.data?.error || 'Search failed');
  return res.data.items || [];
}

// Get trending songs
export async function trending() {
  const res = await http.get('/api/trending');
  if (!res.data?.success) throw new Error('Trending failed');
  return res.data.items || [];
}

// Download audio (MP3) — tries multiple endpoints in order
export async function downloadAudio(urlOrId) {
  const endpoints = ['ytmp3', 'yta', 'yta2', 'yta3', 'mp3', 'audio', 'dlmp3'];
  for (const ep of endpoints) {
    try {
      const res = await http.get(`/download/${ep}`, { params: { url: urlOrId } });
      if (res.data?.success && (res.data.proxyUrl || res.data.downloadUrl)) {
        return {
          title:    res.data.title    || 'Audio',
          videoId:  res.data.videoId  || extractVideoId(urlOrId),
          format:   res.data.format   || 'mp3',
          quality:  res.data.quality  || '320kbps',
          url:      res.data.proxyUrl || res.data.downloadUrl,
          thumb:    res.data.thumbnail,
          ytUrl:    res.data.youtubeUrl,
          via:      ep,
        };
      }
    } catch {}
  }
  throw new Error('All audio endpoints failed');
}

// Download video (MP4) — tries multiple endpoints in order
export async function downloadVideo(urlOrId) {
  const endpoints = ['ytmp4', 'mp4', 'dlmp4', 'video', 'hd'];
  for (const ep of endpoints) {
    try {
      const res = await http.get(`/download/${ep}`, { params: { url: urlOrId } });
      if (res.data?.success && (res.data.proxyUrl || res.data.downloadUrl)) {
        return {
          title:    res.data.title    || 'Video',
          videoId:  res.data.videoId  || extractVideoId(urlOrId),
          format:   res.data.format   || 'mp4',
          quality:  res.data.quality  || '720p',
          url:      res.data.proxyUrl || res.data.downloadUrl,
          thumb:    res.data.thumbnail,
          ytUrl:    res.data.youtubeUrl,
          via:      ep,
        };
      }
    } catch {}
  }
  throw new Error('All video endpoints failed');
}

// Get both audio and video URLs in one call (ytmp5)
export async function downloadBoth(urlOrId) {
  const res = await http.get('/download/ytmp5', { params: { url: urlOrId } });
  if (!res.data?.success) throw new Error('ytmp5 failed');
  return {
    title:   res.data.title,
    videoId: res.data.videoId,
    thumb:   res.data.thumbnail,
    audio: res.data.mp3 ? {
      url:     res.data.mp3.proxyUrl || res.data.mp3.downloadUrl,
      quality: res.data.mp3.quality,
    } : null,
    video: res.data.mp4 ? {
      url:     res.data.mp4.proxyUrl || res.data.mp4.downloadUrl,
      quality: res.data.mp4.quality,
    } : null,
  };
}

// Get lyrics
export async function getLyrics(query) {
  const res = await http.get('/download/lyrics', { params: { q: query } });
  if (!res.data?.success) throw new Error(res.data?.error || 'No lyrics found');
  return res.data;
}

// Download file to buffer from a URL
export async function fetchBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 90000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
    maxRedirects: 5,
  });
  return Buffer.from(res.data);
}

// Convenience: search then download audio
export async function searchAndDownloadAudio(query) {
  const items = await search(query);
  if (!items.length) throw new Error(`No results for "${query}"`);
  const top = items[0];
  const data = await downloadAudio(top.id);
  return { ...data, title: top.title, duration: top.duration, size: top.size };
}

// Convenience: search then download video
export async function searchAndDownloadVideo(query) {
  const items = await search(query);
  if (!items.length) throw new Error(`No results for "${query}"`);
  const top = items[0];
  const data = await downloadVideo(top.id);
  return { ...data, title: top.title, duration: top.duration, size: top.size };
}
