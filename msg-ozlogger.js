const path = require('path');
const bodyParser = require('body-parser');
const fs = require('fs');
const fse = require('fs-extra');
const decache = require('decache');
const stringify = require("json-stringify-safe")

const nodeName = path.basename(__filename).split('.')[0];
let loggedNodes = {};
let flows = {};
let subflows = {};
let nodesInFlow = {};

module.exports = function (RED) {
    const msgTracerConfigFolderPath = path.resolve(RED.settings.userDir, 'msg-ozlogger-config');
    const msgTracerConfigPath = path.join(msgTracerConfigFolderPath, 'local.json');
    let flowManagerConfig;
    const persistFlowManagerConfigFile = async function () {
        await fse.ensureDir(msgTracerConfigFolderPath);
        fs.writeFile(msgTracerConfigPath, JSON.stringify(flowManagerConfig), 'utf8', function () {
        });
    };
    try {
        const buEnv = process.env["NODE_CONFIG_DIR"];
        process.env["NODE_CONFIG_DIR"] = msgTracerConfigFolderPath;
        decache('config');
        flowManagerConfig = JSON.parse(JSON.stringify(require('config')));
        decache('config');
        if (buEnv === undefined) {
            delete process.env["NODE_CONFIG_DIR"];
        } else {
            process.env["NODE_CONFIG_DIR"] = buEnv;
        }
        if (Object.keys(flowManagerConfig).length === 0) throw null;
        loggedNodes = flowManagerConfig.nodes;
    } catch (e) {
        flowManagerConfig = {};
        persistFlowManagerConfigFile();
    }


    function publishloggedNodes() {
        RED.comms.publish(nodeName + "/lognode", loggedNodes, true);
    }

    RED.httpAdmin.post('/' + nodeName + '/removelog', bodyParser.json(), function (req, res) {
        if(req.body && req.body.nodeId){
            delete flowManagerConfig.nodes[req.body.nodeId];
            persistFlowManagerConfigFile();
            publishloggedNodes();
        }
        res.send({ok: true});
    })

    RED.httpAdmin.get('/' + nodeName + '/config', function (req, res) {
        publishloggedNodes();
        res.send();
    })

    //Recebe o evento do botão pra habilitar logger neste nó
    RED.httpAdmin.put('/' + nodeName + '/lognode', bodyParser.json(), function (req, res) {
        if (req.body && req.body.constructor === {}.constructor) {
            loggedNodes = req.body;
            flowManagerConfig.nodes = loggedNodes;
            persistFlowManagerConfigFile();
            res.send({ok: true});
            publishloggedNodes();
        } else {
            res.status(202).send({error: 'Must send json object {...}'});
        }
    });

    function prepareNodesAndFlows(configs) {
        console.log("recarregando");
        flows = {};
        subflows = {};
        nodesInFlow = {}
        for (let node of configs.config.flows) {
            if (node.type === 'tab') {
                flows[node.id] = node.label;
            }
            if (node.type === 'subflow') {
                subflows[node.id] = node.label;
            }
            if (node.z && flows[node.z]) {
                nodesInFlow[node.id] = flows[node.z];
            }
            if (node.z && subflows[node.z]) {
                nodesInFlow[node.id] = subflows[node.z];
            }
        }
        publishloggedNodes();
    }

    function sendToLog(source, msg) {
        let nodeId = source.node.id.split('-');
        nodeId = nodeId[nodeId.length - 1];
        let flowOrSubflow = nodesInFlow[nodeId];

        let level = loggedNodes[nodeId];
        if (level && level.whatLog) {
            loggedNodes[nodeId].name = source.node.name; // caso o nome tenha sido trocado depois, ja atualiza
            let toLog = {
                flow: flowOrSubflow,
                nodeId: nodeId,
                msgId: msg._msgid,
                ...level
            };
            switch (level.whatLog) {
                case'msg':
                    toLog.msg = msg;
                    break;
                case'msg-reqres':
                    toLog.msg = msg;
                    delete toLog.msg.req;
                    delete toLog.msg.res;
                    break;
                case  'payload':
                    toLog.msg = msg.payload;
                    break;
                case 'payload+ozextralogs':
                    toLog.msg = {
                        payload: msg.payload,
                        ozextralogs: msg.ozextralogs
                    }
                    break;
                case 'event-only':
                    break
            }
            console.log(stringify(toLog));
        }

    }

    RED.events.on('nodes:change', prepareNodesAndFlows);
    RED.events.on('flows:started', prepareNodesAndFlows);

    RED.hooks.add("onReceive", (receiveEvent) => {
        sendToLog(receiveEvent.destination, receiveEvent.msg);
    })

    //vamos usar apenas para nós que criam mensagem de eventos externos
    RED.hooks.add("preRoute", (sendEvent) => {
        if (sendEvent.source && sendEvent.source.type === "http in") {
            sendToLog(sendEvent.source, sendEvent.msg);
        }
    });

    //vamos logar caso exista algum erro não tratado na mensagem, vamos logar sempre
    RED.hooks.add("onComplete", (completeEvent) => {
        if (completeEvent.error) {
            let nodeId = completeEvent.node.node.id;
            let flowOrSubflow = nodesInFlow[nodeId];
            console.log(stringify(
                {
                    level: 'error',
                    flow: flowOrSubflow,
                    name: completeEvent.node.node.name,
                    nodeId: nodeId,
                    msgId: completeEvent.msg._msgid,
                    msg: {
                        payload: stringify(completeEvent.msg.payload),
                        error: stringify(completeEvent.error)
                    }
                }));
        }
    });
};
