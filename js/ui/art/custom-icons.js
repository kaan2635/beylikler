// Oyuna özgü birim simgeleri (512 × 512, tek yol; madalyonda simge rengine boyanır).
// game-icons.net'te karşılığı olmayan birimler için çizildi: Yeniçeri ve Topçu.

const circle = (cx, cy, r, sweep = 1) => `M${cx - r} ${cy}a${r} ${r} 0 1 ${sweep} ${2 * r} 0a${r} ${r} 0 1 ${sweep} ${-2 * r} 0Z`;

export const CUSTOM_ICONS = Object.freeze({
  // Yeniçeri: büst; arkaya kıvrılan uzun börk ve kaşıklık, omuzda tüfek (bütün parçalar aynı
  // yönde çizilir ki üst üste binen yerler boşluk olmasın)
  yeniceri: [
    'M120 480C120 380 180 330 256 330C332 330 392 380 392 480Z', // omuzlar
    'M226 290L286 290L286 340L226 340Z', // boyun
    circle(256, 258, 54), // baş
    'M198 232C194 150 212 70 262 40C296 18 342 30 362 66C332 62 306 80 300 120L314 234Z', // börk
    'M190 222L322 222L322 242L190 242Z', // börk bandı
    'M196 204L182 150L198 146L212 200Z', // kaşıklık
    'M384 112L400 116L376 476L360 472Z', // tüfek
  ].join(''),
  // Topçu: dökme top, iki tekerlekli kundak
  topcu: [
    'M74 306L384 172Q424 156 442 190Q456 226 418 242L108 368Z', // namlu
    'M404 152L434 142L466 224L436 236Z', // ağız halkası
    circle(70, 338, 28), // kuyruk topuzu
    circle(205, 404, 92, 1), // tekerlek (dış)
    circle(205, 404, 66, 0), // tekerlek (iç, boşluk)
    'M141 398L269 398L269 410L141 410Z', // parmaklar
    'M199 340L211 340L211 468L199 468Z',
    circle(205, 404, 16),
    'M262 386L476 444L468 474L254 416Z', // kundak
  ].join(''),
});
