const axios = require("axios");
const cheerio = require("cheerio");

// Extract year, part, medium from title
function extractDetails(title) {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const partMatch = title.match(/Part\s?(I{1,3}|II)/i);
  const mediumMatch = title.match(/Sinhala|English|Tamil/i);

  return {
    year: yearMatch ? yearMatch[0] : null,
    part: partMatch ? partMatch[0] : "Full Paper",
    medium: mediumMatch ? mediumMatch[0] : null
  };
}

// Fetch PDF links for a single paper
async function getPaperPDFLinks(paperUrl) {
  try {
    const { data } = await axios.get(paperUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(data);
    const pdfLinks = [];
    const seen = new Set();

    // Direct PDF links
    $("a[href*='.pdf']").each((i, el) => {
      const link = $(el).attr("href");
      const text = $(el).text().trim() || "Download PDF";

      if (!link || seen.has(link)) return;
      seen.add(link);

      let type = "Other";
      if (/PART[-\s]?I\b/i.test(link) || /Part I|MCQ/i.test(text)) type = "Part I (MCQ)";
      else if (/PART[-\s]?II\b/i.test(link) || /Part II|Essay/i.test(text)) type = "Part II (Essay)";

      pdfLinks.push({
        text,
        link,
        type,
        isDirectPDF: true
      });
    });

    return pdfLinks;
  } catch (err) {
    console.error(`Error fetching PDFs from ${paperUrl}:`, err.message);
    return [];
  }
}

// Search papers by term and get PDFs
async function searchPapers(searchTerm = "ict") {
  try {
    const url = `https://www.alevelapi.com/?s=${encodeURIComponent(searchTerm)}`;
    const { data } = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(data);
    const results = [];
    const seenLinks = new Set();

    const paperPromises = [];

    $("li.post-item").each((i, el) => {
      const title = $(el).find("h2.entry-title").text().trim();
      const link = $(el).find("h2.entry-title a").attr("href");

      if (!title || !link || seenLinks.has(link)) return;
      seenLinks.add(link);

      const details = extractDetails(title);

      // Fetch PDF links for each paper
      const promise = getPaperPDFLinks(link).then(pdfLinks => {
        results.push({
          searchLink: url,
          paperTitle: title,
          paperLink: link,
          ...details,
          pdfLinks,
          pdfCount: pdfLinks.length
        });
      });

      paperPromises.push(promise);
    });

    await Promise.all(paperPromises);

    // Sort by year descending
    results.sort((a, b) => (b.year || 0) - (a.year || 0));

    return {
      creator: "Chathura Hansaka",
      status: true,
      searchTerm,
      totalResults: results.length,
      results
    };
  } catch (err) {
    return {
      creator: "Chathura Hansaka",
      status: false,
      error: err.message
    };
  }
}

module.exports = { searchPapers, getPaperPDFLinks };