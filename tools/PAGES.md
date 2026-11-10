# Pages deployment

The source tree exceeded 2 GB, causing repeated Pages sync timeouts (run
42769849628 explicitly warned that the 1 GB limit was exceeded).

`build_pages.py` stages the site below 950 MB. Videos in five large static
libraries are served byte-for-byte from their original public Git commit via
raw.githubusercontent.com; there is no recompression or deletion of originals.
All exact HTML/JS/JSON/CSS references to those files are rewritten in the staged
artifact. Unmatched or dynamically assembled files remain in Pages. New source
updates continue to work without editing generators. Exceeding the safety budget
fails the build before deployment. Original source relative links are unchanged.
