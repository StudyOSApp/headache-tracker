import './surface-coverage.js';
import './pain-core.js';

const Core = globalThis.PainCore;
export const HEAD_MODEL_VERSION = Core.MODEL;
export function painDataForEntry(entry) {
  return {
    entryId: entry.id,
    severity: entry.severity ?? 5,
    painLocations: structuredClone(entry.painLocations || []),
    behindEye: [...(entry.behindEye || [])],
    lastUsedIntensity: entry.lastUsedIntensity ?? Math.max(1, entry.severity ?? 5),
    lastUsedCoverage: entry.lastUsedCoverage ?? 50,
    activePainPointId: entry.activePainPointId || null,
  };
}
export function validatePainData(data) {
  if (!data || typeof data.entryId !== 'string' || !data.entryId ||
      !Number.isInteger(data.severity) || data.severity < 0 || data.severity > 10)
    throw new Error('Pain-map details are invalid.');
  Core.validate({ version: 1, currentEpisodeId: data.entryId, entries: [{
    id: data.entryId, start: '2020-01-01T00:00:00Z',
    painLocations: data.painLocations, behindEye: data.behindEye,
    lastUsedIntensity: data.lastUsedIntensity, lastUsedCoverage: data.lastUsedCoverage,
  }] });
  if (data.activePainPointId !== null && data.activePainPointId !== undefined &&
      !data.painLocations.some(p => p.id === data.activePainPointId))
    throw new Error('The active pain location is invalid.');
  return data;
}
export function entryPainFields(data) {
  validatePainData(data);
  return {
    painModelVersion: HEAD_MODEL_VERSION,
    painLocations: structuredClone(data.painLocations),
    behindEye: [...data.behindEye],
    lastUsedIntensity: data.lastUsedIntensity,
    lastUsedCoverage: data.lastUsedCoverage,
    activePainPointId: data.activePainPointId || null,
  };
}
