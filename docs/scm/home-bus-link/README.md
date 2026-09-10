# Bidirectional home-bus link prototype

Status: bounded prototype; does not complete G6 or G8.

Two fixed inverse routes connect two in-process home buses under one shared fundamental clock. A locally originated W1 word published at T becomes readable on its source bus and is forwarded at T+1, then becomes readable on the destination bus at T+2.

The route preserves W1 content, origin node, origin bus, and content-derived `word_id`. W1 carries no `authority_class`; preserved governed source identity remains the basis for later authority evaluation, and the bridge adds none. Delivery-instance identity also includes route and origin timestep, so identical cyclic content crosses once per timestep. Imported words are never re-forwarded.

T2 OpenTelemetry observes successful forwarding with `t2.scm.bridge.forward`. Observation does not admit, route, mute, satisfy, halt, acknowledge, retry, or retract delivery.

Not implemented or authorized here: DIP mute, G7 halt/freeze, independent or production clock sources, clock-domain crossing, dynamic or multi-hop routing, a manifold node, codec, physical transport, semantic parity, live cutover, G6 completion, or G8 completion.
