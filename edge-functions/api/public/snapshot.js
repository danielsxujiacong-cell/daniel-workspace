import { snapshotRoute } from '../../../server/edge-workspace.js';
export function onRequest(context) { return snapshotRoute(context); }
export default onRequest;
