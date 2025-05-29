(async () => {
  console.log("create.js loaded");

  if (!localStorage.getItem("visited")) {
    localStorage.setItem("visited", "1");
    console.log("переходим на /welcome");
    return window.location.replace("/welcome");
  }

  const API_BASE = window.location.origin;

  const createBtn   = document.getElementById("create");
  const addrInput   = document.getElementById("addr");
  const priceInput  = document.getElementById("price");
  const textArea    = document.getElementById("text");

  function isValidAddress(addr) {
    return addr.startsWith("0x") && addr.length === 42;
  }

  function formatPrice(val) {
    const num = parseFloat(val.replace(",", "."));
    if (isNaN(num) || num < 0) return null;
    return Math.round(num * 100) / 100;
  }

  createBtn.addEventListener("click", async () => {
    const recipient = addrInput.value.trim();
    const content   = textArea.value.trim();
    const priceVal  = formatPrice(priceInput.value.trim());
    if (!content || !isValidAddress(recipient) || priceVal === null) return;

    const priceMicro = Math.round(priceVal * 1e6);
    const res = await fetch(`${API_BASE}/api/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient, price: priceMicro, content })
    });
    if (!res.ok) {
      return alert("Не удалось создать Inside");
    }

    const { slug } = await res.json();
    const url      = `${API_BASE}/${slug}`;

    await navigator.clipboard.writeText(url);

    window.location.replace(`/success?link=${encodeURIComponent(url)}`);
  });
})();