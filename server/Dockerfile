FROM node:20-trixie AS proxybuilder

WORKDIR /
COPY . .
WORKDIR /proxy

RUN npm install


FROM debian:latest AS serverbuilder

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    unzip \
    pkg-config && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /
COPY . .

WORKDIR /server
RUN chmod +x build.sh && ./build.sh


FROM node:20-trixie AS runner

ENV RCON_PASSWORD="changeme"

COPY --from=proxybuilder /proxy /proxy

COPY --from=serverbuilder /server/build/Release /server
COPY --from=serverbuilder /server/entrypoint.sh /server/entrypoint.sh

WORKDIR /server

VOLUME ["/server/baseq3", "/server/cpma"]

EXPOSE 27961
EXPOSE 27960/udp

ENTRYPOINT ["./entrypoint.sh"]
CMD ["+set", "dedicated", "2", "+set", "sv_pure", "1", "+set", "net_ip", "0.0.0.0", "+set", "com_hunkMegs", "256", "+set", "fs_game", "cpma", "+set", "vm_game", "2", "+exec", "server.cfg"]
