const QRCode = require('qrcode');

async function generateQrCodeDataUrl(data) {
  try {
    return await QRCode.toDataURL(data, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (err) {
    console.error('Erro ao gerar QR Code:', err);
    return null;
  }
}

module.exports = { generateQrCodeDataUrl };