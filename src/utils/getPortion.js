const getPortion = (name, unit) => {
  if (unit !== 'Kilogram') return null;
  if (!name) return null;

  const str = name.toString().toUpperCase();

  const patterns = [
    /(\d+)\s*Г(?!\w)/,                    // 300Г
    /(\d+)\s*ГР(?!\w)/,                   // 300ГР
    /(\d+)\s*ГРАММ/,                      // 300 ГРАММ
    /(\d+\.?\d*)\s*КГ/i,                  // 0.5КГ
    /(\d+\.?\d*)\s*KG/i,                  // 1.2 KG
    /(\d+\.?\d*)\s*КИЛОГРАММ/i,           // 2 КИЛОГРАММ
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) {
      let weight = parseFloat(match[1]);

      // 🔴 Определяем единицу по паттерну
      const isKgUnit = /КГ|KG|КИЛОГРАММ/i.test(pattern.toString());

      if (isKgUnit) {
        weight *= 1000; // кг → граммы
      }

      const weightInGrams = Math.round(weight);

      if (weightInGrams >= 10 && weightInGrams <= 5000) {
        return {
          weightInGrams,
          portionLabel: `${weightInGrams} г`,
          portionLabelShort: weightInGrams >= 1000
            ? `${(weightInGrams / 1000).toFixed(1).replace(/\.0$/, '')} кг`
            : `${weightInGrams} г`,
        };
      }
    }
  }

  return null;
};

export default getPortion