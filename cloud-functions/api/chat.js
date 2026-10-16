import { chatRoute } from '../../server/edge-workspace.js';
export function onRequest(context) { return chatRoute(context,false); }
export default onRequest;
