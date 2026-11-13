/* Loads the dataset, then the map scripts in order. */
(() => {
  'use strict';
  const version = 'f8e5d7bb700b';
  const scripts = ["js/model.js", "js/summary.js", "js/navigation.js", "js/landscape.js", "js/app.js", "js/plural.js"];
  const content = document.getElementById('atlas-content');
  const load = src => new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    tag.src = src + '?v=' + version;
    tag.async = false;
    tag.onload = resolve;
    tag.onerror = () => reject(new Error('Could not load ' + src));
    document.body.append(tag);
  });
  fetch('data/landscape.json?v=' + version)
    .then(response => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(data => {
      window.DATA = data;
      return scripts.reduce((chain, src) => chain.then(() => load(src)), Promise.resolve());
    })
    .catch(error => {
      console.error(error);
      content.innerHTML = '<p class="loading">The map could not be loaded. Reload the page, or get the data from the <a href="about.html#data">About</a> page.</p>';
    });
})();
