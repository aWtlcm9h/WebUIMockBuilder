// パーツの登録。新しいパーツ群を追加するときはここに1行足す。
import { registerParts } from './registry';
import { layoutParts } from './layout';
import { basicParts } from './basic';
import { dataParts } from './data';
import { agentParts } from './agent';

registerParts([...layoutParts, ...basicParts, ...dataParts, ...agentParts]);
