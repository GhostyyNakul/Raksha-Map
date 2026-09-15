export function clamp(v, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }
export function computeRisk(input) {
    const flood = clamp(input.rainfall24h / 80 * 35 + input.rainfall72h / 180 * 45);
    const landslide = clamp(input.rainfall72h / 220 * 45 + Math.min(input.elevationM, 3500) / 3500 * 28 + input.vulnerability * .12);
    const cyclone = clamp(input.windKmh / 100 * 70 + input.rainfall24h / 150 * 20);
    const heat = clamp((input.tempC - 32) / 12 * 100);
    const seismic = clamp(input.earthquakeCount * 20);
    const history = clamp(input.history90d * 6);
    const vulnerability = clamp(input.vulnerability);
    const official = input.officialWarningColor ? ({ 1: 75, 2: 60, 3: 38, 4: 18 }[input.officialWarningColor] ?? 0) : 0;
    const scores = { flood, landslide, cyclone, heat, seismic, history, vulnerability };
    const weighted = {
        flood: flood * .28, landslide: landslide * .23, cyclone: cyclone * .17, heat: heat * .10, seismic: seismic * .08,
        history: history * .05, vulnerability: vulnerability * .07, official: official * .24,
    };
    const blended = clamp(Object.values(weighted).reduce((a, b) => a + b, 0) / (1 + (official ? 0.24 : 0)));
    const primaryKey = Object.entries(scores).filter(([k]) => ['flood', 'landslide', 'cyclone', 'heat', 'seismic'].includes(k)).sort((a, b) => b[1] - a[1])[0][0];
    const primary = primaryKey;
    const reasons = [];
    if (input.officialWarningColor)
        reasons.push(`IMD warning colour ${input.officialWarningColor}`);
    if (flood >= 40)
        reasons.push(`${Math.round(input.rainfall24h)} mm rainfall / 24h`);
    if (landslide >= 40)
        reasons.push(`${Math.round(input.rainfall72h)} mm rainfall / 72h + elevated terrain`);
    if (cyclone >= 45)
        reasons.push(`${Math.round(input.windKmh)} km/h wind signal`);
    if (heat >= 50)
        reasons.push(`${input.tempC.toFixed(1)}°C heat load`);
    if (seismic >= 30)
        reasons.push(`${input.earthquakeCount} nearby seismic event(s)`);
    if (history >= 25)
        reasons.push(`${input.history90d} mapped hazard event(s) in recent history`);
    if (vulnerability >= 45)
        reasons.push(`vulnerability layer score ${Math.round(vulnerability)}`);
    if (!reasons.length)
        reasons.push('No elevated live hazard signal');
    const confidence = clamp(55 + (input.officialWarningColor ? 20 : 0) + Math.min(18, input.earthquakeCount * 2) + Math.min(12, input.history90d), 45, 97);
    const priority = blended >= 75 || (blended >= 65 && vulnerability >= 70) ? 'immediate' : blended >= 55 || vulnerability >= 65 ? 'short-term' : 'medium-term';
    return { riskScore: Math.round(blended), primaryHazard: primary, componentScores: { ...scores }, reasons, confidence, relocationPriority: priority };
}
