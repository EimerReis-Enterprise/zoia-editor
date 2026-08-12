# Host the codec as a stateless public service

Public deployment keeps Patch Document authoring, the Module Configuration Registry, recovery, and Patch History in the browser, while anonymous binary parsing and compilation use a same-origin Hosted Codec at `/api/*`. The codec processes bounded requests in memory without retention; this preserves the replaceable HTTP boundary from ADR-0001 while making the editor useful to ZOIA owners who only have `.bin` files.

The public editor must disclose this transient upload before the first binary operation. A codec outage may disable binary operations but must not prevent ordinary Patch Document authoring or JSON saving.
