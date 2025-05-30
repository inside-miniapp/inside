import { sdk } from 'https://esm.sh/@farcaster/frame-sdk';
import { writeContract } from 'https://esm.sh/wagmi/actions';

const splitterAbi = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_token",
				"type": "address"
			},
			{
				"internalType": "uint16",
				"name": "_ownerShare",
				"type": "uint16"
			}
		],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "owner",
				"type": "address"
			}
		],
		"name": "OwnableInvalidOwner",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "account",
				"type": "address"
			}
		],
		"name": "OwnableUnauthorizedAccount",
		"type": "error"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "token",
				"type": "address"
			}
		],
		"name": "SafeERC20FailedOperation",
		"type": "error"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": false,
				"internalType": "uint16",
				"name": "oldShare",
				"type": "uint16"
			},
			{
				"indexed": false,
				"internalType": "uint16",
				"name": "newShare",
				"type": "uint16"
			}
		],
		"name": "OwnerShareChanged",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "previousOwner",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "OwnershipTransferred",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "address",
				"name": "payer",
				"type": "address"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"indexed": false,
				"internalType": "uint256",
				"name": "total",
				"type": "uint256"
			}
		],
		"name": "Paid",
		"type": "event"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "ownerShare",
		"outputs": [
			{
				"internalType": "uint16",
				"name": "",
				"type": "uint16"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "recipient",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "amount",
				"type": "uint256"
			}
		],
		"name": "pay",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "renounceOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint16",
				"name": "_newShare",
				"type": "uint16"
			}
		],
		"name": "setOwnerShare",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "token",
		"outputs": [
			{
				"internalType": "contract IERC20",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "newOwner",
				"type": "address"
			}
		],
		"name": "transferOwnership",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	}
];

const splitterAddress = "0x8D2fa85E80c58Fb2ee637C55Ef602102d87dC6fb";

function makeNonce(len = 12) {
  let s = "";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('DOMContentLoaded', async () => {

  await sdk.actions.ready();

  const nonce = makeNonce(12);

  await sdk.actions.signIn({
    nonce,
    acceptAuthAddress: true,
  });

  const { userId: warpcastId } = await sdk.context;
  const headers = { "Farcaster-User": warpcastId };

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
      const metaRes2 = await fetch(`${API_BASE}/api/meta/${id}`, { headers });
      if (!metaRes2.ok) throw new Error("No meta");
      const { recipient, price } = await metaRes2.json();

      const { hash } = await writeContract({
        address:       splitterAddress,
        abi:           splitterAbi,
        functionName:  'pay',
        args:          [ recipient, price ],
        value:         0,
        walletClient:  window.wagmiConfig.publicClient,
      });
      await window.wagmiConfig.publicClient.waitForTransactionReceipt({ hash });

      await fetch(`${API_BASE}/api/markpaid/${id}?token=${token}`, {
        method: 'POST',
        headers
      });

      const insideRes = await fetch(`${API_BASE}/api/inside/${id}?token=${token}`, { headers });
      const { content: real } = await insideRes.json();
      text.textContent = real;
      content.classList.remove('blur');
      overlay.style.display = 'none';

    } catch (err) {
      console.error("Payment failed or access denied", err);
    }
  });
});
