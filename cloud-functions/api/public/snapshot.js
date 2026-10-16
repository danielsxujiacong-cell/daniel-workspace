import { publicationRoute } from '../../../server/publication.js';
export function onRequest(context) { return publicationRoute(context); }
export default onRequest;
