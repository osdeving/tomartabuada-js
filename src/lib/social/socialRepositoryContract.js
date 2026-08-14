/**
 * Porta de persistência usada pelo serviço social.
 *
 * Todos os métodos retornam Promise. Um adaptador HTTP pode substituir o
 * repositório em memória sem alterar consumidores do serviço. `recordPointEvent`
 * deve ser atômico e idempotente pela tupla (userId, source, sourceId).
 */
export const SOCIAL_REPOSITORY_METHODS = Object.freeze([
  "authenticate",
  "getUser",
  "listUsers",
  "listClans",
  "listTeams",
  "listDisputes",
  "listPointEvents",
  "findPointEvent",
  "insertTeam",
  "insertDispute",
  "finishDispute",
  "recordPointEvent",
]);

export function requireSocialRepository(repository) {
  const missing = SOCIAL_REPOSITORY_METHODS.filter(
    (method) => typeof repository?.[method] !== "function",
  );

  if (missing.length > 0) {
    throw new TypeError(`Repositório social incompleto: ${missing.join(", ")}.`);
  }

  return repository;
}
