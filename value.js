(function (scope) {
  'use strict';
  const bounds = {
    requests: [0, 1000], manual: [0, 120], assisted: [0, 120],
    maintenance: [0, 200], setup: [0, 1000], rate: [0, 500], tools: [0, 400]
  };
  function estimate(values) {
    for (const [name, [min, max]] of Object.entries(bounds)) {
      const value = values[name];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return null;
    }
    const hours = values.requests * (values.manual - values.assisted) * (52 / 12) / 60 - values.maintenance;
    return { hours, firstMonth: hours - values.setup, capacity: hours * values.rate, netValue: hours * values.rate - values.tools };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { estimate, bounds };
  else scope.ProposalValue = { estimate, bounds };
})(typeof globalThis !== 'undefined' ? globalThis : this);
