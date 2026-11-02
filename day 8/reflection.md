# Reflection

**The most difficult concept**

The hardest concept for me was estimating load and then deciding what a system needs because of it. At first the numbers felt abstract. I could divide by 100,000 seconds, but I did not see why 10 writes per second or 500 reads per second should lead to different designs. I overcame it by doing the calculations for every project (SnapShare, QuickNotes and TicketHub) and asking the same question each time: is this read-heavy or write-heavy, and what does that change? After a few rounds, caches, read replicas and queues stopped being a list of words and became answers to specific problems. Transactions and unique constraints also became clear once I wrote the seat-holding query for TicketHub myself.

**What I would improve in my capstone**

In my QuickNotes capstone, I would improve how the app handles errors and validation. The feedback I received was that messages should be clearer and closer to where the problem is, so I would show an error next to the title field instead of only in the status line, and make the error messages more specific. I would also add a loading state to each Delete button, so users can see which note is being removed.

**What I will learn next**

Next, I want to build a real backend for QuickNotes, so I will keep learning Python and use it to create the API I designed, with a database behind it. I will also continue my AWS cloud training, so I can learn how services such as a load balancer, a managed database and object storage fit together to run a design like TicketHub in real life.
