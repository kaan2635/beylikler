// Kaynak türleri ve onları üreten binalar.
export const RESOURCES = Object.freeze({
  odun: { name: 'Odun', producer: 'oduncu' },
  kil: { name: 'Kil', producer: 'kilocagi' },
  demir: { name: 'Demir', producer: 'demirmadeni' },
});

export const RESOURCE_IDS = Object.keys(RESOURCES);
