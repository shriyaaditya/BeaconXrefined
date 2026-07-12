const BASELINES = {
  'Rescue Equipment': 0.1,
  'Medical Supplies': 0.8,
  'Lighting & Power': 0.2,
  'Water & Sanitation': 1.5,
  'Shelter & Camps': 0.5,
  'Food & Survival': 4.0,
  'Communication': 0.1,
  'Emergency Vehicles': 0.05
};

function calculateBurnRate(resource, totalDrawdown) {
  const dynamicBurn = totalDrawdown / 12; // based on 12h horizon
  const category = (resource.metadata && resource.metadata.category) || 'Default';
  const baseline = BASELINES[category] || 0.1;
  return parseFloat((baseline + dynamicBurn).toFixed(2));
}

function calculateForecast(availableQty, burnRate) {
  if (burnRate > 0) {
    return parseFloat((availableQty / burnRate).toFixed(1));
  }
  return null;
}

function attachMetrics(centers, movements) {
  return centers.map(center => {
    let scoreWeight = 0;
    const resources = center.resources.map(res => {
      const relevantMovements = movements.filter(m =>
        m.center_id === center.center_id &&
        m.item_code === res.item_code &&
        (m.type === 'consume' || m.type === 'spike' || m.type === 'transfer')
      );

      let totalDrawdown = 0;
      relevantMovements.forEach(m => {
        if (m.type === 'transfer') {
          totalDrawdown += m.quantity; // Assuming transfer out is represented
        } else {
          totalDrawdown += Math.abs(m.quantity);
        }
      });

      const burnRate = calculateBurnRate(res, totalDrawdown);
      const runoutHours = calculateForecast(res.available_qty, burnRate);

      const threshold = res.min_threshold || 1;
      const ratio = res.available_qty / threshold;
      scoreWeight += Math.min(ratio, 1.0);

      return {
        ...res,
        burn_rate: burnRate,
        runout_hours: runoutHours
      };
    });

    const readinessScore = resources.length > 0
      ? Math.round((scoreWeight / resources.length) * 100)
      : 100;

    return {
      ...center,
      resources,
      readiness_score: readinessScore
    };
  });
}

function checkShortages(centers) {
  const shortages = [];

  centers.forEach(center => {
    center.resources.forEach(res => {
      if (res.available_qty < res.min_threshold) {
        shortages.push({
          center_id: center.center_id,
          center_name: center.center_name,
          district: center.district,
          region: center.region,
          item_code: res.item_code,
          name: res.name,
          available_qty: res.available_qty,
          min_threshold: res.min_threshold,
          deficit: res.min_threshold - res.available_qty,
          category: (res.metadata && res.metadata.category) ? res.metadata.category : null,
          unit: (res.metadata && res.metadata.unit) ? res.metadata.unit : null
        });
      }
    });
  });

  return shortages;
}

module.exports = {
  calculateBurnRate,
  calculateForecast,
  attachMetrics,
  checkShortages
};
