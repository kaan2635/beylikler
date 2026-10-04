// Oyuna özgü birim simgeleri (512 × 512, tek yol; madalyonda simge rengine boyanır).
// game-icons.net'te karşılığı olmayan birimler için çizildi: Yeniçeri, Topçu, Arbaletçi, Tatar Atlısı ve Lağımcı.

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
  // Arbaletçi: geniş yay, kirişi ve merkezdeki cıvata.
  arbaletci: [
    'M92 160C132 110 202 102 256 143C310 102 380 110 420 160L384 185C340 145 300 155 270 190L270 245L242 245L242 190C212 155 172 145 128 185Z',
    'M70 170L442 170L442 194L70 194Z',
    'M236 188L276 188L292 332L220 332Z',
    'M218 316L294 316L315 352L197 352Z',
    'M250 192L262 192L264 438L252 438Z',
    'M238 350L274 350L284 378L228 378Z',
  ].join(''),
  // Tatar atlısı: at üstünde yay çeken süvari.
  tatarlisi: [
    'M96 300C124 266 178 250 234 263L288 278L322 253L365 266L402 296L385 321L344 309L321 337L300 408L274 405L278 345L236 327L214 407L187 407L184 331L142 334L126 414L100 414L104 330L73 319Z',
    'M317 254L344 221L383 224L402 247L390 274L360 274L344 296Z',
    'M80 292C49 274 41 249 54 222C70 247 91 252 107 254Z',
    'M193 257L222 213L263 214L286 255L265 287L221 284Z',
    circle(242, 180, 33),
    'M212 157C219 117 249 103 278 125L291 161L267 151L244 162Z',
    'M210 230L171 198L181 181L223 205Z',
    'M271 226L317 184L330 198L292 249Z',
    'M330 174C368 133 403 148 418 178C400 169 384 170 371 188C359 207 358 229 368 246C344 235 332 211 330 174Z',
    'M328 186L390 247L378 259L316 198Z',
  ].join(''),
  // Lağımcı: sur altında çalışan kazmacı; çapraz kazma ve kürek.
  lagimci: [
    'M82 394L360 116L389 145L111 423Z',
    'M325 89L395 82L432 124L395 161L352 143Z',
    'M89 133L174 95L187 125L102 163Z',
    'M139 160L164 145L375 407L350 427Z',
    'M312 355L399 377L391 408L304 386Z',
    'M75 432L420 432L420 462L75 462Z',
  ].join(''),
});
