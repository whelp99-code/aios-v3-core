FROM node:22-slim

# Create non-root user for sandboxed execution
RUN groupadd -r sandbox && useradd -r -g sandbox -d /workspace -s /bin/false sandbox

# Create workspace directory
RUN mkdir -p /workspace && chown sandbox:sandbox /workspace

# Create /tmp with proper permissions (needed even with read-only rootfs)
RUN mkdir -p /tmp && chmod 1777 /tmp

# Switch to non-root user
USER sandbox
WORKDIR /workspace

# Default command (overridden at runtime)
CMD ["node", "-e", "console.log('sandbox ready')"]
