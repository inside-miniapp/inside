document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('DOMContentLoaded', async () => {

  const API_BASE = window.location.origin;
  const content  = document.getElementById('card-content');
  const text     = document.getElementById('card-text');
  const overlay  = document.getElementById('overlay');
  const btn      = document.getElementById('get');

  const slug = location.pathname.slice(1);
  const [id, token] = slug.split("-");

  if (!id || !token) {
    text.textContent = 'Invalid link';
    return;
  }

  try {
    const metaRes = await fetch(`${API_BASE}/api/meta/${id}`, { headers });
    if (!metaRes.ok) throw new Error("No meta");
    const meta = await metaRes.json();
    const price = meta.price;
    const priceUsdc = (price / 1e6).toFixed(2);
    btn.textContent = price === 0
      ? "Get Inside"
      : `Get Inside ($${priceUsdc})`;

    if (price === 0) {
      const res = await fetch(`${API_BASE}/api/inside/${id}?token=${token}`, { headers });
      const { content: real } = await res.json();
      text.textContent = real;
      content.classList.remove('blur');
      overlay.style.display = 'none';
      return;
    }

    const tryRes = await fetch(`${API_BASE}/api/inside/${id}?token=${token}`, { headers });
    if (tryRes.ok) {
      const { content: real } = await tryRes.json();
      text.textContent = real;
      content.classList.remove('blur');
      overlay.style.display = 'none';
      return;
    }
    throw new Error("not paid");
  } catch {
    content.classList.add('blur');
    overlay.style.display = 'flex';
    text.textContent = 'With Inside, you can create a paid message and share it, earning money from each purchase of the secret information by others.';
  }

  btn.addEventListener('click', async () => {
    try {
      const metaRes = await fetch(`${API_BASE}/api/meta/${id}`, { headers });
      if (!metaRes.ok) throw new Error("No meta");
      const { recipient, price } = await metaRes.json();

      // pay for the inside

      await fetch(`${API_BASE}/api/markpaid/${id}?token=${token}`, {
        method: 'POST',
        headers
      });

      const insideRes = await fetch(
        `${API_BASE}/api/inside/${id}?token=${token}`,
        { headers }
      );
      const { content: real } = await insideRes.json();
      text.textContent = real;
      content.classList.remove('blur');
      overlay.style.display = 'none';

    } catch (err) {
      console.error("Payment failed or access denied", err);
    }
  });

});