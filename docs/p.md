I'm trying to import and use a github repo as a dependency in my node project. But there's something not right. In package.json I have:
"hyperdata-clients": "github:danja/hyperdata-clients", and there's a :
import { ClientFactory as HyperdataClientFactory } from 'hyperdata-clients'
intended to use `/home/danny/hyperdata/hyperdata-clients/src/common/ClientFactory.js`, which has `export default ClientFactory` in the github codebase. This is all using ES modules. Please advise.
