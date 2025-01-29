# Memory Dynamics in Semem

The memory system in Semem mimics human memory by implementing both decay and reinforcement mechanisms. This creates a dynamic system where frequently accessed, relevant memories remain readily available while less useful ones gradually fade.

## Decay Mechanism
Memories in Semem decay over time following an exponential decay function:

decayFactor = baseDecay * Math.exp(-decayRate * timeDiff)

Where:
- baseDecay starts at 1.0 for new memories
- decayRate is configurable (default 0.0001)
- timeDiff is the time since last access in seconds

This creates a natural forgetting curve where older memories become progressively less influential in retrieval unless reinforced.

## Reinforcement System
Every time a memory is accessed during retrieval:
1. Its accessCount increments
2. The timestamp updates to current time
3. The decayFactor increases by 10% (multiplied by 1.1)
4. A reinforcement boost is calculated as log(accessCount + 1)

This creates a rich-get-richer dynamic where useful memories become more likely to be retrieved again.

## Memory Classification
Memories that exceed an access threshold (default 10 accesses) get promoted to long-term memory. This creates two tiers:
- Short-term: Recent or infrequently accessed memories
- Long-term: Frequently accessed, well-established memories

The system maintains balance through regular cleanup cycles that assess and adjust memory status based on these dynamics.