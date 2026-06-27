FROM rust:1.83-bookworm AS build
WORKDIR /app
COPY Cargo.toml ./
COPY services/docproc ./services/docproc
RUN cargo build --release -p hogyoku-docproc

FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /app/target/release/hogyoku-docproc /usr/local/bin/hogyoku-docproc
ENTRYPOINT ["/usr/local/bin/hogyoku-docproc"]
