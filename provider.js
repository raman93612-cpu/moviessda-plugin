const axios = require('axios');
const cheerio = require('cheerio');

// Ads & Pop-up Redirects-ஐ தவிர்க்கும் Custom Headers
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

class MoviesdaProvider {
  constructor() {
    this.name = "Moviesda Tamil HD";
    // Screenshots-ல் உள்ள வொர்க்கிங் மெயின் டொமைன்
    this.baseUrl = "https://moviesdatamil.me";
  }

  // 1. Search Logic / Home Listing
  async search(query) {
    try {
      let targetUrl = `${this.baseUrl}/search.xhtml?q=${encodeURIComponent(query)}`;
      let res = await axios.get(targetUrl, { headers: HEADERS, timeout: 10000 });
      let $ = cheerio.load(res.data);
      let results = [];

      $('a').each((i, el) => {
        let title = $(el).text().trim();
        let href = $(el).attr('href');

        if (href && title && (href.includes('/godari-gattu') || href.includes('-2026') || href.includes('-movies') || href.includes('.xhtml'))) {
          let fullUrl = href.startsWith('http') ? href : `${this.baseUrl}/${href.replace(/^\//, '')}`;
          results.push({
            id: fullUrl,
            title: title,
            type: "movie"
          });
        }
      });

      return results;
    } catch (err) {
      console.error("Search Fetch Error:", err.message);
      return [];
    }
  }

  // 2. Fetch Resolutions & Single Parts (360p, 720p, 1080p)
  async getMovieQualities(movieUrl) {
    try {
      let res = await axios.get(movieUrl, { headers: HEADERS, timeout: 10000 });
      let $ = cheerio.load(res.data);
      let qualities = [];

      $('a').each((i, el) => {
        let text = $(el).text().trim();
        let href = $(el).attr('href');

        if (href && (text.includes('1080p') || text.includes('720p') || text.includes('360p') || text.includes('.mp4'))) {
          let fullUrl = href.startsWith('http') ? href : `${this.baseUrl}/${href.replace(/^\//, '')}`;
          qualities.push({
            qualityName: text,
            url: fullUrl
          });
        }
      });

      return qualities;
    } catch (err) {
      console.error("Quality Extract Error:", err.message);
      return [];
    }
  }

  // 3. Complete Workflow Extraction (0 to 100% Stream Link)
  async getStreams(qualityPageUrl) {
    try {
      // PAGE 1: Movie File Detail Page (download/g...)
      let res1 = await axios.get(qualityPageUrl, { headers: HEADERS, timeout: 10000 });
      let $1 = cheerio.load(res1.data);
      let server1Url = $1('a:contains("Download Server 1")').attr('href');

      if (!server1Url) {
        server1Url = $1('a:contains("Download Server 2")').attr('href');
      }
      if (!server1Url) return [];

      // Fix Relative URL
      if (!server1Url.startsWith('http')) {
        server1Url = new URL(server1Url, qualityPageUrl).href;
      }

      // PAGE 2: Redirect Page (download.moviespage.xyz)
      let res2 = await axios.get(server1Url, { 
        headers: { ...HEADERS, 'Referer': qualityPageUrl },
        timeout: 10000 
      });
      let $2 = cheerio.load(res2.data);
      let server2Url = $2('a:contains("Download Server 1")').attr('href');

      if (!server2Url) {
        server2Url = $2('a:contains("Download Server 2")').attr('href');
      }
      if (!server2Url) return [];

      if (!server2Url.startsWith('http')) {
        server2Url = new URL(server2Url, server1Url).href;
      }

      // PAGE 3: Final Download/Watch Online Page (movies.downloadpage.xyz)
      let res3 = await axios.get(server2Url, { 
        headers: { ...HEADERS, 'Referer': server1Url },
        timeout: 10000 
      });
      let $3 = cheerio.load(res3.data);

      // Extract Direct CDN File Link (Screenshots-ல் உள்ள fast.northpanda.xyz MP4 Link)
      let directStreamUrl = $3('a:contains("Download Server 1")').attr('href') || 
                            $3('a:contains("Watch Online Server 1")').attr('href') ||
                            $3('a:contains("Watch Online")').attr('href');

      if (directStreamUrl) {
        if (!directStreamUrl.startsWith('http')) {
          directStreamUrl = new URL(directStreamUrl, server2Url).href;
        }

        return [
          {
            name: "Moviesda Fast Server (Direct MP4)",
            url: directStreamUrl,
            quality: "HD",
            type: "mp4",
            headers: {
              'User-Agent': HEADERS['User-Agent'],
              'Referer': server2Url
            }
          }
        ];
      }

      return [];
    } catch (err) {
      console.error("Final Stream Link Extraction Failed:", err.message);
      return [];
    }
  }
}

module.exports = new MoviesdaProvider();
