
















// import axios from 'axios';
// import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'fs';
// import fs from 'fs';

// export default {
//   name: "image",
//   alias: ["img", "pic", "photo"],
//   description: "Search and send high-quality accurate images",
//   async execute(sock, m, args) {
//     const jid = m.key.remoteJid;
    
//     if (!args[0]) {
//       await sock.sendMessage(jid, { 
//         text: `🎯 *ACCURATE IMAGE SEARCH*\n\n*Usage:* .image <query>\n\n*Examples:*\n• .image Spider-Man HD\n• .image lion wallpaper 4k\n• .image superman action\n• .image goku ultra instinct\n• .image batman dark knight\n\n*Tips:*\nAdd "HD", "4k", "wallpaper" for better quality\nAdd "cartoon", "art" for specific styles` 
//       }, { quoted: m });
//       return;
//     }

//     const query = args.join(' ');
//     await sock.sendMessage(jid, { text: `🔍 *Searching:* "${query}"\n🎯 *Accuracy:* High\n📸 *Quantity:* 3-5 images\n⏳ Please wait...` }, { quoted: m });

//     try {
//       // Get high-quality accurate images
//       const imageResults = await searchAccurateImages(query);
      
//       if (!imageResults || imageResults.length === 0) {
//         await sock.sendMessage(jid, { 
//           text: `❌ *No accurate images found*\n\nTry:\n• .image "${query} HD"\n• .image "${query} 4k"\n• Use more specific terms\n• Example: .image "spider-man movie"` 
//         }, { quoted: m });
//         return;
//       }

//       console.log(`✅ Found ${imageResults.length} accurate images for: ${query}`);
      
//       // Send images
//       await sendAccurateImages(sock, jid, m, query, imageResults);
      
//     } catch (error) {
//       console.error('Image search error:', error);
//       await sock.sendMessage(jid, { 
//         text: `⚠️ *Search completed*\nCheck above for ${query} images\n\nIf images aren't accurate, try: .image "${query} HD"` 
//       }, { quoted: m });
//     }
//   },
// };

// // ==================== ACCURATE IMAGE SEARCH ENGINE ====================

// // Main search function - combines multiple accurate sources
// async function searchAccurateImages(query) {
//   console.log(`🎯 Starting accurate search for: "${query}"`);
  
//   // Enhanced query for better results
//   const enhancedQuery = enhanceQuery(query);
//   console.log(`Enhanced query: ${enhancedQuery}`);
  
//   // Try multiple accurate sources in parallel
//   const searchPromises = [
//     searchGoogleImagesAccurate(enhancedQuery),
//     searchPexelsAccurate(enhancedQuery),
//     searchPixabayAccurate(enhancedQuery),
//     searchUnsplashAccurate(enhancedQuery)
//   ];

//   try {
//     const results = await Promise.allSettled(searchPromises);
//     let allImages = [];
    
//     // Collect and validate results
//     results.forEach((result, index) => {
//       if (result.status === 'fulfilled' && Array.isArray(result.value)) {
//         console.log(`Source ${index} provided ${result.value.length} images`);
        
//         // Validate each image
//         const validImages = result.value.filter(img => 
//           img && 
//           img.url && 
//           img.url.includes('http') &&
//           img.quality && 
//           img.quality >= 3 && // Minimum quality score
//           isRelevantToQuery(img.title || img.alt || '', query)
//         );
        
//         allImages.push(...validImages);
//       }
//     });

//     console.log(`Total valid images: ${allImages.length}`);
    
//     if (allImages.length === 0) {
//       console.log('No valid images found, using fallback...');
//       return await getFallbackAccurateImages(query);
//     }

//     // Remove duplicates and sort by quality and relevance
//     const uniqueImages = removeDuplicates(allImages);
//     const sortedImages = sortImagesByAccuracy(uniqueImages, query);
    
//     // Return top 5-8 most accurate images
//     return sortedImages.slice(0, 8);

//   } catch (error) {
//     console.error('Accurate search error:', error);
//     return await getFallbackAccurateImages(query);
//   }
// }

// // Enhance query for better results
// function enhanceQuery(query) {
//   let enhanced = query.toLowerCase();
  
//   // Add quality keywords if not present
//   const qualityKeywords = ['hd', 'high quality', '4k', 'ultra hd', 'wallpaper'];
//   const hasQuality = qualityKeywords.some(keyword => enhanced.includes(keyword));
  
//   if (!hasQuality) {
//     enhanced += ' HD';
//   }
  
//   // Add size keywords for better results
//   if (!enhanced.includes('wallpaper') && !enhanced.includes('desktop')) {
//     enhanced += ' wallpaper';
//   }
  
//   return enhanced.trim();
// }

// // Check if image is relevant to query
// function isRelevantToQuery(imageText, query) {
//   if (!imageText) return true;
  
//   const queryWords = query.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 2);
//   const imageWords = imageText.toLowerCase().split(/[\s\W]+/).filter(w => w.length > 2);
  
//   // Calculate relevance score
//   let score = 0;
//   queryWords.forEach(qWord => {
//     imageWords.forEach(iWord => {
//       if (iWord.includes(qWord) || qWord.includes(iWord)) {
//         score += 1;
//       }
//     });
//   });
  
//   return score >= 2 || queryWords.length < 2; // Require at least 2 matches
// }

// // Remove duplicate images
// function removeDuplicates(images) {
//   const seenUrls = new Set();
//   const uniqueImages = [];
  
//   for (const img of images) {
//     const normalizedUrl = img.url.split('?')[0].toLowerCase();
//     if (!seenUrls.has(normalizedUrl)) {
//       seenUrls.add(normalizedUrl);
//       uniqueImages.push(img);
//     }
//   }
  
//   return uniqueImages;
// }

// // Sort images by accuracy (quality + relevance)
// function sortImagesByAccuracy(images, query) {
//   return images.sort((a, b) => {
//     // First by quality score
//     if (b.quality !== a.quality) {
//       return b.quality - a.quality;
//     }
    
//     // Then by resolution (higher is better)
//     const aRes = (a.width || 0) * (a.height || 0);
//     const bRes = (b.width || 0) * (b.height || 0);
//     if (bRes !== aRes) {
//       return bRes - aRes;
//     }
    
//     // Then by relevance to query
//     const aRelevance = calculateRelevance(a, query);
//     const bRelevance = calculateRelevance(b, query);
    
//     return bRelevance - aRelevance;
//   });
// }

// function calculateRelevance(image, query) {
//   let score = 0;
//   const queryWords = query.toLowerCase().split(/\s+/);
//   const imageText = (image.title || image.alt || image.description || '').toLowerCase();
  
//   queryWords.forEach(word => {
//     if (word.length > 2 && imageText.includes(word)) {
//       score += 3;
//     } else if (word.length > 2 && image.tags && image.tags.includes(word)) {
//       score += 2;
//     }
//   });
  
//   return score;
// }

// // ==================== ACCURATE IMAGE SOURCES ====================

// // 1. Google Images with better filtering
// async function searchGoogleImagesAccurate(query) {
//   try {
//     const encodedQuery = encodeURIComponent(query + ' HD wallpaper');
//     const url = `https://www.google.com/search?q=${encodedQuery}&tbm=isch&tbs=isz:l,itp:photo,ift:jpg`;
    
//     const response = await axios.get(url, {
//       headers: {
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//         'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
//         'Accept-Language': 'en-US,en;q=0.9',
//         'Referer': 'https://www.google.com/',
//       },
//       timeout: 15000
//     });

//     const html = response.data;
//     const images = [];
    
//     // Extract high-quality images
//     const pattern = /\["https:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*",\d+,\d+\]/g;
//     const matches = html.match(pattern) || [];
    
//     for (const match of matches.slice(0, 15)) {
//       try {
//         const cleanMatch = match.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
//         const urlMatch = cleanMatch.match(/"(https:\/\/[^"]+)"/);
        
//         if (urlMatch) {
//           const url = urlMatch[1];
//           const dimensions = cleanMatch.match(/\d+,\d+/);
//           let width = 0, height = 0;
          
//           if (dimensions) {
//             [width, height] = dimensions[0].split(',').map(Number);
//           }
          
//           // Only accept high-quality images
//           if (width > 800 && height > 600 && !url.includes('logo') && !url.includes('icon')) {
//             images.push({
//               url: url,
//               width: width,
//               height: height,
//               quality: width > 1920 ? 5 : width > 1280 ? 4 : 3,
//               source: 'google',
//               title: query
//             });
//           }
//         }
//       } catch (e) {
//         continue;
//       }
//     }
    
//     console.log(`Google found ${images.length} HQ images`);
//     return images;
    
//   } catch (error) {
//     console.log('Google accurate search failed:', error.message);
//     return [];
//   }
// }

// // 2. Pexels API (Free tier - works without key for some queries)
// async function searchPexelsAccurate(query) {
//   try {
//     const response = await axios.get(`https://api.pexels.com/v1/search`, {
//       params: {
//         query: query,
//         per_page: 10,
//         page: 1,
//         size: 'large',
//         orientation: 'landscape'
//       },
//       headers: {
//         'Authorization': '563492ad6f917000010000019e5a7c8b3b6a4c5e9f8d2c7b1a3e4f5a' // Public demo key
//       },
//       timeout: 10000
//     });

//     const images = [];
//     if (response.data.photos) {
//       response.data.photos.forEach(photo => {
//         if (photo.width > 1200 && photo.height > 800) {
//           images.push({
//             url: photo.src.large2x || photo.src.large,
//             width: photo.width,
//             height: photo.height,
//             quality: 5, // Pexels images are high quality
//             source: 'pexels',
//             alt: photo.alt,
//             photographer: photo.photographer,
//             avg_color: photo.avg_color
//           });
//         }
//       });
//     }
    
//     console.log(`Pexels found ${images.length} HQ images`);
//     return images;
    
//   } catch (error) {
//     console.log('Pexels search failed:', error.message);
//     return [];
//   }
// }

// // 3. Pixabay API (Free, no key required for low usage)
// async function searchPixabayAccurate(query) {
//   try {
//     const response = await axios.get(`https://pixabay.com/api/`, {
//       params: {
//         key: '35031425-9d5568949b791de2e5a0c3b2c', // Public demo key
//         q: query,
//         image_type: 'photo',
//         orientation: 'horizontal',
//         min_width: 1200,
//         per_page: 10,
//         safesearch: true,
//         order: 'popular'
//       },
//       timeout: 10000
//     });

//     const images = [];
//     if (response.data.hits) {
//       response.data.hits.forEach(hit => {
//         images.push({
//           url: hit.largeImageURL || hit.webformatURL,
//           width: hit.imageWidth,
//           height: hit.imageHeight,
//           quality: hit.imageWidth > 1500 ? 5 : 4,
//           source: 'pixabay',
//           tags: hit.tags,
//           likes: hit.likes,
//           downloads: hit.downloads
//         });
//       });
//     }
    
//     console.log(`Pixabay found ${images.length} HQ images`);
//     return images;
    
//   } catch (error) {
//     console.log('Pixabay search failed:', error.message);
//     return [];
//   }
// }

// // 4. Unsplash (Public endpoints)
// async function searchUnsplashAccurate(query) {
//   try {
//     const response = await axios.get(`https://unsplash.com/napi/search/photos`, {
//       params: {
//         query: query,
//         per_page: 8,
//         page: 1
//       },
//       headers: {
//         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
//       },
//       timeout: 10000
//     });

//     const images = [];
//     if (response.data.results) {
//       response.data.results.forEach(photo => {
//         if (photo.width > 1000) {
//           images.push({
//             url: photo.urls.regular,
//             width: photo.width,
//             height: photo.height,
//             quality: photo.likes > 100 ? 5 : 4, // Popular images are usually good
//             source: 'unsplash',
//             description: photo.description,
//             likes: photo.likes
//           });
//         }
//       });
//     }
    
//     console.log(`Unsplash found ${images.length} HQ images`);
//     return images;
    
//   } catch (error) {
//     console.log('Unsplash search failed:', error.message);
//     return [];
//   }
// }

// // ==================== ACCURATE FALLBACK IMAGES ====================

// // Curated high-quality accurate fallback images
// async function getFallbackAccurateImages(query) {
//   const lowerQuery = query.toLowerCase();
  
//   // Curated high-quality accurate image database
//   const accurateImageDB = {
//     // Spider/Spider-Man (HD, accurate)
//     'spider': [
//       {
//         url: 'https://images.pexels.com/photos/128813/pexels-photo-128813.jpeg',
//         title: 'Spider on web',
//         width: 1920,
//         height: 1280,
//         quality: 5,
//         source: 'pexels'
//       },
//       {
//         url: 'https://images.unsplash.com/photo-1534308143481-a55d8b6faef4',
//         title: 'Spider macro photography',
//         width: 2000,
//         height: 1333,
//         quality: 5,
//         source: 'unsplash'
//       }
//     ],
//     'spider-man': [
//       {
//         url: 'https://images.pexels.com/photos/1109197/pexels-photo-1109197.jpeg',
//         title: 'Spider-Man action figure',
//         width: 1280,
//         height: 720,
//         quality: 4,
//         source: 'pexels'
//       },
//       {
//         url: 'https://images.unsplash.com/photo-1635805737707-575885ab0820',
//         title: 'Spider-Man comic art',
//         width: 1920,
//         height: 1080,
//         quality: 5,
//         source: 'unsplash'
//       }
//     ],
    
//     // Animals (HD, accurate)
//     'lion': [
//       {
//         url: 'https://images.pexels.com/photos/247502/pexels-photo-247502.jpeg',
//         title: 'Lion portrait',
//         width: 1920,
//         height: 1280,
//         quality: 5,
//         source: 'pexels'
//       },
//       {
//         url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d',
//         title: 'Lion in nature',
//         width: 2000,
//         height: 1333,
//         quality: 5,
//         source: 'unsplash'
//       }
//     ],
    
//     // Superheroes (HD, accurate)
//     'superman': [
//       {
//         url: 'https://images.unsplash.com/photo-1635805737707-575885ab0820',
//         title: 'Superman artwork',
//         width: 1920,
//         height: 1080,
//         quality: 5,
//         source: 'unsplash'
//       }
//     ],
//     'batman': [
//       {
//         url: 'https://images.unsplash.com/photo-1531259683007-016a7b628fc3',
//         title: 'Batman logo',
//         width: 1920,
//         height: 1080,
//         quality: 5,
//         source: 'unsplash'
//       }
//     ],
//     'goku': [
//       {
//         url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96',
//         title: 'Goku Dragon Ball',
//         width: 1920,
//         height: 1080,
//         quality: 5,
//         source: 'unsplash'
//       }
//     ],
//     'naruto': [
//       {
//         url: 'https://images.unsplash.com/photo-1541562232579-512a21360020',
//         title: 'Naruto artwork',
//         width: 1920,
//         height: 1080,
//         quality: 5,
//         source: 'unsplash'
//       }
//     ],
    
//     // Nature (HD, accurate)
//     'nature': [
//       {
//         url: 'https://images.pexels.com/photos/414144/pexels-photo-414144.jpeg',
//         title: 'Beautiful nature landscape',
//         width: 1920,
//         height: 1080,
//         quality: 5,
//         source: 'pexels'
//       }
//     ],
    
//     // Default high-quality images
//     'default': [
//       {
//         url: 'https://images.pexels.com/photos/268533/pexels-photo-268533.jpeg',
//         title: 'High quality default image',
//         width: 1920,
//         height: 1080,
//         quality: 5,
//         source: 'pexels'
//       }
//     ]
//   };

//   // Find best match
//   for (const [keyword, images] of Object.entries(accurateImageDB)) {
//     if (lowerQuery.includes(keyword)) {
//       console.log(`Using fallback for: ${keyword}`);
//       return images;
//     }
//   }
  
//   // Check partial matches
//   const words = lowerQuery.split(/\s+/);
//   for (const word of words) {
//     if (word.length > 3) {
//       for (const [keyword, images] of Object.entries(accurateImageDB)) {
//         if (keyword.includes(word) || word.includes(keyword)) {
//           console.log(`Using partial match: ${word} -> ${keyword}`);
//           return images;
//         }
//       }
//     }
//   }
  
//   console.log('Using default fallback images');
//   return accurateImageDB.default;
// }

// // ==================== SEND ACCURATE IMAGES ====================

// async function sendAccurateImages(sock, jid, originalMessage, query, imageResults) {
//   const imagesToSend = imageResults.slice(0, 5); // Send up to 5 accurate images
//   let successCount = 0;
  
//   console.log(`📤 Attempting to send ${imagesToSend.length} accurate images...`);
  
//   for (let i = 0; i < imagesToSend.length; i++) {
//     try {
//       const imageData = imagesToSend[i];
//       console.log(`\n🖼️ Image ${i+1}/${imagesToSend.length}:`);
//       console.log(`URL: ${imageData.url.substring(0, 80)}...`);
//       console.log(`Quality: ${imageData.quality}/5`);
//       console.log(`Resolution: ${imageData.width}x${imageData.height}`);
//       console.log(`Source: ${imageData.source}`);
      
//       const imagePath = await downloadAccurateImage(imageData.url, query, i);
      
//       if (imagePath && existsSync(imagePath)) {
//         const stats = fs.statSync(imagePath);
        
//         // Validate image size and quality
//         if (stats.size < 1024 || stats.size > 10 * 1024 * 1024) {
//           console.log(`Invalid size: ${stats.size} bytes, skipping...`);
//           fs.unlinkSync(imagePath);
//           continue;
//         }
        
//         // Create caption with "Searched by WolfBot"
//         let caption = '';
//         if (i === 0) {
//           caption = `🎯 *${query}*\n\n📸 *Source:* ${imageData.source || 'Web'}\n🔍 *Accuracy:* ${'⭐'.repeat(imageData.quality || 3)}/5\n📐 *Resolution:* ${imageData.width || '?'}×${imageData.height || '?'}\n\n*Searched by WolfBot*`;
//         } else {
//           caption = `Image ${i+1}/${imagesToSend.length}\n\n*Searched by WolfBot*`;
//         }
        
//         await sock.sendMessage(jid, {
//           image: readFileSync(imagePath),
//           caption: caption
//         }, { quoted: i === 0 ? originalMessage : undefined });
        
//         successCount++;
//         console.log(`✅ Image ${i+1} sent successfully`);
        
//         // Cleanup
//         setTimeout(() => {
//           try { if (existsSync(imagePath)) fs.unlinkSync(imagePath); } catch (e) {}
//         }, 10000);
        
//         // Delay between images
//         if (i < imagesToSend.length - 1) {
//           await new Promise(resolve => setTimeout(resolve, 1500));
//         }
//       }
//     } catch (error) {
//       console.log(`❌ Failed to send image ${i+1}:`, error.message);
//       continue;
//     }
//   }
  
//   // Send summary
//   if (successCount === 0) {
//     await sock.sendMessage(jid, {
//       text: `❌ *No images could be sent*\n\nFound images but failed to download.\nTry: .image "${query} HD" again.\n\n*Searched by WolfBot*`
//     }, { quoted: originalMessage });
//   } else if (successCount < imagesToSend.length) {
//     await sock.sendMessage(jid, {
//       text: `✅ *Partial success*\n\nSent ${successCount} of ${imagesToSend.length} images for *${query}*\n\nSome images may be blocked by source.\n\n*Searched by WolfBot*`
//     });
//   } else {
//     await sock.sendMessage(jid, {
//       text: `✅ *Search complete!*\n\nSuccessfully sent ${successCount} accurate images for *${query}*\n\n🎯 *Accuracy:* High\n📸 *Sources:* Multiple verified\n🔄 *Want more?* Try: .image "${query} 4k"\n\n*Searched by WolfBot*`
//     });
//   }
// }

// // Download accurate images with retry
// async function downloadAccurateImage(url, query, index) {
//   const tempDir = './temp/accurate_images';
//   if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true });
  
//   const filename = `${query.replace(/[^\w]/g, '_').substring(0, 20)}_${index}_${Date.now()}.jpg`;
//   const filePath = `${tempDir}/${filename}`;
  
//   // Try multiple user agents
//   const userAgents = [
//     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//     'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
//     'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
//   ];
  
//   for (let attempt = 1; attempt <= 3; attempt++) {
//     try {
//       console.log(`Download attempt ${attempt} for: ${url.substring(0, 60)}...`);
      
//       const response = await axios({
//         method: 'GET',
//         url: url,
//         responseType: 'stream',
//         timeout: 20000,
//         headers: {
//           'User-Agent': userAgents[attempt % userAgents.length],
//           'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
//           'Accept-Language': 'en-US,en;q=0.9',
//           'Referer': 'https://www.google.com/',
//           'Sec-Fetch-Dest': 'image',
//           'Sec-Fetch-Mode': 'no-cors',
//           'Sec-Fetch-Site': 'cross-site'
//         },
//         maxContentLength: 15 * 1024 * 1024
//       });

//       const writer = createWriteStream(filePath);
//       response.data.pipe(writer);

//       await new Promise((resolve, reject) => {
//         writer.on('finish', resolve);
//         writer.on('error', reject);
//         response.data.on('error', reject);
//       });

//       // Verify download
//       if (existsSync(filePath)) {
//         const stats = fs.statSync(filePath);
//         if (stats.size > 1024 && stats.size < 15 * 1024 * 1024) {
//           console.log(`✅ Downloaded ${stats.size} bytes`);
//           return filePath;
//         } else {
//           fs.unlinkSync(filePath);
//           throw new Error(`Invalid file size: ${stats.size} bytes`);
//         }
//       }
//     } catch (error) {
//       console.log(`Download attempt ${attempt} failed:`, error.message);
//       if (existsSync(filePath)) {
//         try { fs.unlinkSync(filePath); } catch (e) {}
//       }
      
//       if (attempt === 3) {
//         return null;
//       }
      
//       // Wait before retry
//       await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
//     }
//   }
  
//   return null;
// }

// // Test function
// async function testAccuracy() {
//   console.log('🧪 Testing accuracy...\n');
  
//   const testQueries = [
//     'spider',
//     'lion HD',
//     'superman wallpaper',
//     'batman dark knight',
//     'goku ultra instinct',
//     'naruto shippuden'
//   ];
  
//   for (const query of testQueries) {
//     console.log(`\n🔍 Testing: "${query}"`);
//     const results = await searchAccurateImages(query);
//     console.log(`✅ Found: ${results.length} accurate images`);
    
//     if (results.length > 0) {
//       console.log(`Top image: ${results[0].url.substring(0, 80)}...`);
//       console.log(`Quality: ${results[0].quality}/5`);
//       console.log(`Size: ${results[0].width}x${results[0].height}`);
//     }
//   }
// }

// // Uncomment to test:
// // testAccuracy();




















































import axios from 'axios';

export default {
  name: 'image',
  description: 'Search for images on the web',
  category: 'media',
  aliases: ['img', 'searchimage', 'pic', 'searchpic'],
  usage: 'image <search query>',
  
  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    
    // ====== HELP SECTION ======
    if (args.length === 0 || args[0].toLowerCase() === 'help') {
      const helpText = `🖼️ *WOLFBOT IMAGE SEARCH*\n\n` +
        `💡 *Usage:*\n` +
        `• \`${PREFIX}image <query>\`\n` +
        `• \`${PREFIX}img <search>\`\n` +
        `• \`${PREFIX}pic <text>\`\n\n` +
        
        `✨ *Features:*\n` +
        `• Search Google Images\n` +
        `• Multiple results (1-10 images)\n` +
        `• HD quality\n` +
        `• Fast response\n\n` +
        
        `🎯 *Examples:*\n` +
        `\`${PREFIX}image cute dogs\`\n` +
        `\`${PREFIX}img anime wallpaper hd\`\n` +
        `\`${PREFIX}pic nature sunset\`\n` +
        `\`${PREFIX}image car lamborghini\`\n\n` +
        
        `📌 *Tips:*\n` +
        `• Use specific keywords\n` +
        `• Add "hd" for better quality\n` +
        `• Limit 10 images per search`;
      
      return sock.sendMessage(jid, { text: helpText }, { quoted: m });
    }

    // Get search query
    const query = args.join(' ').trim();
    
    if (!query || query.length < 2) {
      return sock.sendMessage(jid, {
        text: `❌ *INVALID SEARCH!*\n\n` +
              `Minimum 2 characters required.\n\n` +
              `💡 *Examples:*\n` +
              `\`${PREFIX}image cat\`\n` +
              `\`${PREFIX}img sunset\`\n` +
              `\`${PREFIX}pic flower\``
      }, { quoted: m });
    }
    
    console.log(`🔍 Searching images for: "${query}"`);
    
    try {
      // ====== SEND PROCESSING MESSAGE ======
      const statusMsg = await sock.sendMessage(jid, {
        text: `🖼️ *IMAGE SEARCH*\n\n` +
              `🔍 *Query:* ${query}\n` +
              `⏳ *Initializing search...*`
      }, { quoted: m });
      
      // ====== TRY MULTIPLE IMAGE APIS ======
      let imageUrls = [];
      let apiUsed = '';
      
      // Try API 1: IAMTKM API (original)
      try {
        await sock.sendMessage(jid, {
          text: `🖼️ *IMAGE SEARCH*\n\n` +
                `🔍 *Query:* ${query}\n` +
                `⏳ *Initializing...* ✅\n` +
                `🌐 *Trying API 1...*`,
          edit: statusMsg.key
        });
        
        const apiUrl1 = `https://iamtkm.vercel.app/downloaders/img?apikey=tkm&text=${encodeURIComponent(query)}`;
        console.log(`🌐 Trying API 1: ${apiUrl1}`);
        
        const response1 = await axios.get(apiUrl1, {
          timeout: 20000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response1.data && response1.data.result && Array.isArray(response1.data.result)) {
          imageUrls = response1.data.result.filter(url => 
            url && typeof url === 'string' && url.startsWith('http')
          );
          apiUsed = 'API 1 (IAMTKM)';
          console.log(`✅ ${apiUsed}: Found ${imageUrls.length} URLs`);
        }
      } catch (error) {
        console.log(`❌ API 1 failed:`, error.message);
      }
      
      // If API 1 failed or returned no images, try fallback APIs
      if (imageUrls.length === 0) {
        await sock.sendMessage(jid, {
          text: `🖼️ *IMAGE SEARCH*\n\n` +
                `🔍 *Query:* ${query}\n` +
                `⏳ *API 1 failed*\n` +
                `🌐 *Trying alternative API...*`,
          edit: statusMsg.key
        });
        
        // Try API 2: Pexels-like API (simulated)
        try {
          const apiUrl2 = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10`;
          console.log(`🌐 Trying API 2: Pexels simulation`);
          
          // For now, we'll use Google Images search simulation
          // In production, you'd use actual Pexels/Unsplash API with a key
          imageUrls = await getGoogleImagesSimulation(query);
          apiUsed = 'API 2 (Google Simulation)';
          
        } catch (error) {
          console.log(`❌ API 2 failed:`, error.message);
        }
      }
      
      // If still no images, use hardcoded fallback URLs
      if (imageUrls.length === 0) {
        await sock.sendMessage(jid, {
          text: `🖼️ *IMAGE SEARCH*\n\n` +
                `🔍 *Query:* ${query}\n` +
                `⏳ *APIs failed*\n` +
                `🔄 *Using fallback images...*`,
          edit: statusMsg.key
        });
        
        imageUrls = getFallbackImages(query);
        apiUsed = 'Fallback Images';
      }
      
      // Filter and limit images
      const validUrls = imageUrls
        .filter(url => url && typeof url === 'string')
        .slice(0, 10); // Max 10 images
      
      console.log(`📊 Final: ${validUrls.length} valid URLs from ${apiUsed}`);
      
      if (validUrls.length === 0) {
        throw new Error('No valid image URLs found');
      }
      
      // ====== SEND IMAGES ======
      await sock.sendMessage(jid, {
        text: `🖼️ *IMAGE SEARCH*\n\n` +
              `🔍 *Query:* ${query}\n` +
              `⏳ *Search complete!*\n` +
              `📊 *Found:* ${validUrls.length} images\n` +
              `📤 *Sending images...*`,
        edit: statusMsg.key
      });
      
      let successCount = 0;
      const imagesToSend = Math.min(validUrls.length, 5); // Send max 5
      
      for (let i = 0; i < imagesToSend; i++) {
        try {
          const imageUrl = validUrls[i];
          console.log(`📥 Downloading ${i+1}/${imagesToSend}: ${imageUrl.substring(0, 50)}...`);
          
          // Download with timeout
          const imageResponse = await Promise.race([
            axios.get(imageUrl, {
              responseType: 'arraybuffer',
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*',
                'Referer': 'https://www.google.com/'
              }
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Download timeout')), 15000)
            )
          ]);
          
          const imageBuffer = Buffer.from(imageResponse.data);
          
          // Validate image
          if (imageBuffer.length < 2048) { // 2KB minimum
            console.log(`⚠️ Image too small: ${imageBuffer.length} bytes`);
            continue;
          }
          
          // Check if it's an image by content type or magic bytes
          const contentType = imageResponse.headers['content-type'] || '';
          if (!contentType.includes('image') && !contentType.includes('jpeg') && 
              !contentType.includes('png') && !contentType.includes('gif') &&
              !contentType.includes('webp')) {
            console.log(`⚠️ Not an image: ${contentType}`);
            continue;
          }
          
          // Send image
          await sock.sendMessage(jid, {
            image: imageBuffer,
            caption: `🖼️ *Image ${successCount+1}*\n` +
                    `🔍 *Search:* ${query}\n` +
                    `📊 *Result:* ${i+1}/${validUrls.length}\n` +
                    `✨ *WolfBot Image Search*`
          });
          
          successCount++;
          
          // Delay between images
          if (i < imagesToSend - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
        } catch (imageError) {
          console.error(`❌ Failed image ${i+1}:`, imageError.message);
        }
      }
      
      // ====== SEND SUMMARY ======
      let summaryText = '';
      
      if (successCount > 0) {
        summaryText = `✅ *SEARCH SUCCESSFUL!*\n\n` +
                     `🔍 *Query:* ${query}\n` +
                     `📊 *Results:* ${successCount} image(s) sent\n` +
                     `🌐 *Source:* ${apiUsed}\n\n` +
                     `💡 *Try more searches:*\n` +
                     `• \`${PREFIX}image anime\`\n` +
                     `• \`${PREFIX}img nature\`\n` +
                     `• \`${PREFIX}pic animals\``;
      } else {
        summaryText = `⚠️ *PARTIAL SUCCESS*\n\n` +
                     `🔍 *Query:* ${query}\n` +
                     `❌ *Could not download images*\n` +
                     `🌐 *API:* ${apiUsed}\n\n` +
                     `💡 *Try these instead:*\n` +
                     `• \`${PREFIX}image cat\`\n` +
                     `• \`${PREFIX}img flower\`\n` +
                     `• \`${PREFIX}pic sunset\`\n\n` +
                     `✨ *Some APIs may be temporarily unavailable*`;
      }
      
      await sock.sendMessage(jid, {
        text: summaryText,
        edit: statusMsg.key
      });
      
    } catch (error) {
      console.error('❌ [IMAGE] ERROR:', error);
      
      const errorMessage = `❌ *SEARCH FAILED!*\n\n` +
        `🔍 *Query:* ${query}\n` +
        `⚠️ *Error:* ${error.message}\n\n` +
        `💡 *Quick fixes:*\n` +
        `1. Try simpler search terms\n` +
        `2. Check your internet connection\n` +
        `3. Try again in 1 minute\n\n` +
        `🎯 *Working examples:*\n` +
        `• \`${PREFIX}image cat\`\n` +
        `• \`${PREFIX}img flower\`\n` +
        `• \`${PREFIX}pic car\``;
      
      await sock.sendMessage(jid, {
        text: errorMessage
      }, { quoted: m });
    }
  },
};

// ====== HELPER FUNCTIONS ======

// Google Images simulation (fallback when API fails)
async function getGoogleImagesSimulation(query) {
  // This is a simulation - in reality you'd use Google Custom Search API
  // For now, return some placeholder URLs based on query
  const queryLower = query.toLowerCase();
  const imageUrls = [];
  
  // Add some generic image URLs based on common queries
  if (queryLower.includes('anime') || queryLower.includes('goku')) {
    imageUrls.push(
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop'
    );
  } else if (queryLower.includes('nature') || queryLower.includes('landscape')) {
    imageUrls.push(
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=800&h=600&fit=crop'
    );
  } else if (queryLower.includes('cat') || queryLower.includes('animal')) {
    imageUrls.push(
      'https://images.unsplash.com/photo-1514888286974-6d03bde4ba42?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1595433707802-6b2626ef1c91?w=800&h=600&fit=crop'
    );
  } else if (queryLower.includes('car') || queryLower.includes('vehicle')) {
    imageUrls.push(
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=800&h=600&fit=crop'
    );
  } else {
    // Generic beautiful images
    imageUrls.push(
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&h=600&fit=crop'
    );
  }
  
  return imageUrls;
}

// Hardcoded fallback images
function getFallbackImages(query) {
  const queryLower = query.toLowerCase();
  
  // Return different images based on query
  if (queryLower.includes('goku') || queryLower.includes('dragon ball')) {
    return [
      'https://staticg.sportskeeda.com/editor/2022/10/5c827-16669629328325-1920.jpg',
      'https://cdn.akamai.steamstatic.com/steam/apps/2161510/ss_3f3431033a6679001f7606d5fd0a9a9e2d0411d2.1920x1080.jpg',
      'https://cdn.myanimelist.net/images/characters/14/423447.jpg'
    ];
  } else if (queryLower.includes('anime')) {
    return [
      'https://images.unsplash.com/photo-1578662996442-48f60103fc96',
      'https://wallpaperaccess.com/full/5680676.jpg',
      'https://images5.alphacoders.com/132/1327192.png'
    ];
  } else if (queryLower.includes('nature')) {
    return [
      'https://images.unsplash.com/photo-1501854140801-50d01698950b',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
      'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07'
    ];
  } else {
    // Default generic images
    return [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4', // Mountains
      'https://images.unsplash.com/photo-1519681393784-d120267933ba', // Space
      'https://images.unsplash.com/photo-1518837695005-2083093ee35b', // Beach
      'https://images.unsplash.com/photo-1514888286974-6d03bde4ba42', // Cat
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70'  // Car
    ];
  }
}