# node-red-contrib-msg-ozlogger

Desenvolvido por: DevOZ Team <dev@ozmap.com.br>  

Email: [jose.raupp@ozmap.com.br](mailto:jose.raupp@ozmap.com.br)

## Sobre

O módulo `node-red-contrib-msg-ozlogger` foi projetado com o objetivo de auxiliar usuários do Node-RED a habilitar logs em nós específicos dentro de seus flows. Ele oferece flexibilidade no tipo de mensagem que pode ser logada:

- Mensagem inteira
- Apenas o payload
- Mensagem sem o req/res

## Uso Principal

A intenção primária é que os logs gerados por este módulo sejam consumidos por um serviço de monitoramento e análise de logs. Ele é compatível e foi pensado para integração com sistemas como o Grafana-Loki e o Victoria Logs.

## Instalação

Para instalar, você pode usar npm:

```bash
npm install node-red-contrib-msg-ozlogger
```
## Desenvolvimento

Como rodar para testar mofidicações:

```bash
    docker run -d --name nodered-test --rm -p 1880:1880 -v $PWD:/node-red-contrib-msg-ozlogger nodered/node-red

    //Depois que estiver rodadno, entre no container e instale o pacote
    docker exec -it nodered-test bash

    npm install /node-red-contrib-msg-ozlogger

    exit

    docker restart nodered-test

```

Depois basta acessar o Node-RED em http://localhost:1880

Para ver os logs, pode utilizar

```bash
    docker logs -f --tail 200 nodered-test
```

