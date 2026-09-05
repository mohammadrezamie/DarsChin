import urllib.request
import re
import os

req = urllib.request.Request("https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap")
req.add_header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36")
css = urllib.request.urlopen(req).read().decode('utf-8')

urls = re.findall(r'url\((https://[^)]+)\)', css)
for i, url in enumerate(urls):
    filename = url.split('/')[-1]
    print(f"Downloading {url} to extension/fonts/{filename}")
    urllib.request.urlretrieve(url, f"extension/fonts/{filename}")
    css = css.replace(url, f"./fonts/{filename}")

with open('extension/fonts.css', 'w') as f:
    f.write(css)
