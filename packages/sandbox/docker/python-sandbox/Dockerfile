FROM python:3.11-slim

# Create non-root user for sandboxed execution
RUN groupadd -r sandbox && useradd -r -g sandbox -d /workspace -s /bin/false sandbox

# Create workspace directory
RUN mkdir -p /workspace && chown sandbox:sandbox /workspace

# Create /tmp with proper permissions (needed even with read-only rootfs)
RUN mkdir -p /tmp && chmod 1777 /tmp

# Install commonly needed packages (minimal)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Switch to non-root user
USER sandbox
WORKDIR /workspace

# Default command (overridden at runtime)
CMD ["python3", "-c", "print('sandbox ready')"]
