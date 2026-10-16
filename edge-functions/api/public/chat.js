import { chatRoute } from '../../../server/edge-workspace.js';
export function onRequest(context) { return chatRoute(context,true); }
export default onRequest;
