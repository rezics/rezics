FROM debian:trixie-slim AS build
RUN apt-get update && apt-get install --yes --no-install-recommends ca-certificates git g++ make \
    && rm -rf /var/lib/apt/lists/*
ARG GMARK_REVISION=77be5b620375f2fabf1b14204d1d1f899d8f8425
RUN git clone --filter=blob:none --no-checkout https://github.com/gbagan/gmark.git /src \
    && git -C /src checkout "$GMARK_REVISION" \
    && test "$(git -C /src rev-parse HEAD)" = "$GMARK_REVISION" \
    && make -C /src/src -j2 CFLAGS='-O2 -std=c++11 -I ../libs'

FROM debian:trixie-slim
RUN apt-get update && apt-get install --yes --no-install-recommends libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/src/test /usr/local/bin/gmark
COPY --from=build /src/LICENSE /usr/share/doc/gmark/LICENSE
WORKDIR /work
ENTRYPOINT ["gmark"]
