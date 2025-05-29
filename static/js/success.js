document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('copy');
  const params = new URLSearchParams(location.search);
  const link = params.get('link') || '';
  btn.addEventListener('click', () => {
    if (link) navigator.clipboard.writeText(link);
  });
});