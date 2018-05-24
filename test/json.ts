import {NatsWsProxy} from "./helpers/nats-wsproxy";
import {test} from "ava";
import {NatsConnection} from "../src/nats";
import {Msg} from "../src/protocol";
import {Lock} from "./helpers/latch";
import {startServer, stopServer} from "./helpers/nats_server_control";
import {Nuid} from 'js-nuid/src/nuid';

const nuid = new Nuid();

let WS_HOSTPORT = "127.0.0.1:12123";

test.before((t) => {
    return new Promise((resolve, reject) => {
        startServer(WS_HOSTPORT)
            .then((server) => {
                t.log('server started');
                t.context = {server: server};

                NatsConnection.connect({url: `ws://${WS_HOSTPORT}`, json: true})
                    .then(nc => {
                        //@ts-ignore
                        t.context.nc = nc;
                        resolve();
                    });
            })
            .catch((err) => {
                reject(err);
            });
    });
});

test.after.always((t) => {
    //@ts-ignore
    stopServer(t.context.server);
});


test('connect no json propagates options', async (t) => {
    t.plan(2);
    let nc = await NatsConnection.connect({url: `ws://${WS_HOSTPORT}`});
    t.is(nc.options.json, false, 'nc options');
    t.is(nc.protocol.options.json, false, 'protocol');
    nc.close();
});

test('connect json propagates options', async (t) => {
    t.plan(2);
    let nc = await NatsConnection.connect({url: `ws://${WS_HOSTPORT}`, json: true});
    t.is(nc.options.json, true, 'nc options');
    t.is(nc.protocol.options.json, true, 'protocol');
    nc.close();
});

function macro(t: any, input: any): Promise<any> {
    t.plan(1);
    let subj = nuid.next();
    let lock = new Lock();
    let nc = t.context.nc;
    nc.subscribe(subj, (msg: Msg) => {
        // in JSON undefined is translated to null
        if (input === undefined) {
            input = null;
        }
        t.deepEqual(msg.data, input);
        // t.log([input, '===', msg.data]);
        lock.unlock();
    });

    nc.publish(subj, input);
    nc.flush();
    return lock.latch;
}

test('string', macro, 'helloworld');
test('empty', macro, '');
test('null', macro, null);
test('undefined', macro, undefined);
test('number', macro, 10);
test('false', macro, false);
test('true', macro, true);
test('empty array', macro, []);
test('any array', macro, [1, 'a', false, 3.1416]);
test('empty object', macro, {});
test('object', macro, {a: 1, b: false, c: 'name', d: 3.1416});