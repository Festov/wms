const DOC_PREFIX = "/doc";

export function docListPath(entityCode: string) {
  return `${DOC_PREFIX}/${entityCode}`;
}

export function docDetailPath(entityCode: string, id: string) {
  return `${DOC_PREFIX}/${entityCode}/${id}`;
}

export function docNewPath(entityCode: string) {
  return `${DOC_PREFIX}/${entityCode}/new`;
}

export function docLineNewPath(entityCode: string, docId: string) {
  return `${DOC_PREFIX}/${entityCode}/${docId}/new`;
}

export function docLineEditPath(
  entityCode: string,
  docId: string,
  lineId: string,
) {
  return `${DOC_PREFIX}/${entityCode}/${docId}/lines/${lineId}`;
}
