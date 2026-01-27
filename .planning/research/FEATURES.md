# Settings & Home Management Features Research

**Research Type:** Project Research — Features dimension for settings page UI redesign
**Context:** Restructuring settings page from 4 tabs to side menu with 3 sections + danger zone; extracting Home management to standalone page
**Date:** 2026-01-27

---

## Settings Pages

### Table Stakes (Must Have)

These are the minimum requirements to avoid user dissatisfaction. Missing or poorly executing these will cause users to say "hell no".

#### Navigation & Structure
- **Side navigation on the left** (Complexity: Low)
  - Visual attention leans left 80% of the time on websites
  - Supports efficient vertical scanning
  - Can accommodate growth without breaking layout
  - Recommended width: 240-300px expanded, 48-64px collapsed
  - Source: [NN/G Vertical Navigation](https://www.nngroup.com/articles/vertical-nav/)

- **Clear visual hierarchy** (Complexity: Low)
  - Users should always know where they are
  - Use the "7±2 rule" — about 7 items max per category
  - Parent-child relationships for nested settings
  - Source: [8 Settings Page UI Examples](https://bricxlabs.com/blogs/settings-page-ui-examples)

- **Logical grouping and categorization** (Complexity: Low)
  - Group related settings together
  - Use recognizable section names
  - Progressive disclosure for advanced options
  - Source: [App Settings UI Design](https://www.setproduct.com/blog/settings-ui-design)

#### Interaction Patterns
- **Immediate feedback on changes** (Complexity: Low)
  - Show when settings are saved/applied
  - Loading states for async operations
  - Error states with clear messaging
  - Source: [Best UX Practices for Sidebar Menu](https://uiuxdesigntrends.com/best-ux-practices-for-sidebar-menu-in-2025/)

- **Confirmation for destructive actions** (Complexity: Medium)
  - Ask users to explicitly confirm irreversible actions
  - Prevent accidental data loss
  - Multiple safeguards for critical operations
  - Source: [Managing Dangerous Actions](https://www.smashingmagazine.com/2024/09/how-manage-dangerous-actions-user-interfaces/)

- **Sticky/persistent navigation** (Complexity: Low)
  - Side menu remains accessible while scrolling
  - Current section highlighted
  - Easy to jump between sections
  - Source: [Best UX Practices for Sidebar Menu](https://uiuxdesigntrends.com/best-ux-practices-for-sidebar-menu-in-2025/)

#### Accessibility
- **Keyboard navigation support** (Complexity: Low)
  - Tab order follows visual hierarchy
  - Focus indicators visible
  - Arrow keys for menu navigation
  - Source: [Best UX Practices for Sidebar Menu](https://uiuxdesigntrends.com/best-ux-practices-for-sidebar-menu-in-2025/)

- **Clear labels and descriptions** (Complexity: Low)
  - No jargon or ambiguous terms
  - Helper text for complex settings
  - Accessible color contrast
  - Source: [App Settings UI Design](https://www.setproduct.com/blog/settings-ui-design)

#### Core Functionality
- **Sense of control and customization** (Complexity: Low)
  - Users feel empowered, not overwhelmed
  - Settings actually work and persist
  - Changes apply predictably
  - Source: [App Settings UI Design](https://www.setproduct.com/blog/settings-ui-design)

### Differentiators (Nice UX Touches)

These features won't be missed if absent, but create delight and satisfaction when present.

#### Smart Organization
- **Collapsible sub-items** (Complexity: Low)
  - Expand/collapse nested settings on demand
  - Reduce visual clutter
  - Remember expansion state per user
  - Source: [Best UX Practices for Sidebar Menu](https://uiuxdesigntrends.com/best-ux-practices-for-sidebar-menu-in-2025/)

- **Search functionality** (Complexity: Medium)
  - Find settings quickly in complex apps
  - Highlight matching terms
  - Show setting location in hierarchy
  - Source: [8 Settings Page UI Examples](https://bricxlabs.com/blogs/settings-page-ui-examples)

- **Contextual help** (Complexity: Medium)
  - Inline tooltips or help icons
  - Links to documentation
  - Examples or previews of settings impact
  - Source: [8 Settings Page UI Examples](https://bricxlabs.com/blogs/settings-page-ui-examples)

#### Visual Polish
- **Mode switching (light/dark)** (Complexity: Low)
  - Toggle in settings or accessible globally
  - Smooth transitions
  - Respect system preferences
  - Source: [Best UX Practices for Sidebar Menu](https://uiuxdesigntrends.com/best-ux-practices-for-sidebar-menu-in-2025/)

- **Real-time updates/sync indicators** (Complexity: Medium)
  - Show when settings sync across devices
  - Indicate offline vs online state
  - Optimistic UI updates
  - Source: [Best UX Practices for Sidebar Menu](https://uiuxdesigntrends.com/best-ux-practices-for-sidebar-menu-in-2025/)

- **Calm, minimalist design** (Complexity: Low)
  - Uncluttered interfaces
  - Emphasize essential elements
  - Let users breathe
  - Source: [12 UI/UX Design Trends 2026](https://www.index.dev/blog/ui-ux-design-trends)

#### Smart Interactions
- **Inline confirmation for dangerous actions** (Complexity: Medium)
  - Click once changes label to "Click again to confirm"
  - Alternative to modal dialogs
  - Reduces friction while maintaining safety
  - Note: Risk of double-click accidents
  - Source: [Bitesized UX: Substack's Danger Zone](https://builtformars.com/ux-bites/highway-to-the-danger-zone)

- **Reduced clicks for key tasks** (Complexity: Medium)
  - Streamline common workflows
  - Speed equals trust in 2026
  - Performance-aware design
  - Source: [12 UI/UX Design Trends 2026](https://www.index.dev/blog/ui-ux-design-trends)

#### Account Management
- **Easy account switching** (Complexity: Medium)
  - Quick profile/account selector
  - Shows current account clearly
  - Smooth transitions between accounts
  - Source: [Best UX Practices for Sidebar Menu](https://uiuxdesigntrends.com/best-ux-practices-for-sidebar-menu-in-2025/)

### Anti-Features (Things to Deliberately NOT Build)

These are distractions that don't move the needle on table stakes or differentiation.

#### Complexity Without Purpose
- **Danger zone for everything** (Complexity: N/A)
  - Only use for truly critical actions (account deletion, ownership transfers, money transfers)
  - Don't create a danger zone for the sake of having one
  - Overuse dilutes its purpose
  - Source: [Managing Dangerous Actions](https://www.smashingmagazine.com/2024/09/how-manage-dangerous-actions-user-interfaces/)

- **Excessive nesting beyond 2-3 levels** (Complexity: N/A)
  - Deep hierarchies confuse users
  - Increases cognitive load
  - Makes settings hard to find
  - Source: [8 Settings Page UI Examples](https://bricxlabs.com/blogs/settings-page-ui-examples)

- **Settings that nobody needs** (Complexity: N/A)
  - Avoid "kitchen sink" approach
  - Every setting adds maintenance burden
  - Focus on what users actually customize
  - Source: [Table Stakes Over Features](https://thinkingthrough.substack.com/p/table-stakes-over-features-why-its)

#### Poor UX Patterns
- **Tabs within settings sections** (Complexity: N/A)
  - Users often misuse tabs for navigation
  - Side navigation is better for scalable content
  - Tabs work better for filtering same content
  - Source: [Tabs UX Best Practices](https://www.eleken.co/blog-posts/tabs-ux)

- **Auto-save without indication** (Complexity: N/A)
  - Users need feedback that changes are saved
  - Silent auto-save creates uncertainty
  - Show explicit save confirmation
  - Source: [App Settings UI Design](https://www.setproduct.com/blog/settings-ui-design)

- **Modal overload** (Complexity: N/A)
  - Too many confirmation modals fatigue users
  - Users start clicking through without reading
  - Use inline patterns where appropriate
  - Source: [Managing Dangerous Actions](https://www.smashingmagazine.com/2024/09/how-manage-dangerous-actions-user-interfaces/)

#### Visual Noise
- **Loud, busy designs** (Complexity: N/A)
  - 2026 trend is toward calm UI
  - Settings should be functional, not flashy
  - Reduce visual competition
  - Source: [12 UI/UX Design Trends 2026](https://www.index.dev/blog/ui-ux-design-trends)

- **Scroll storytelling in settings** (Complexity: N/A)
  - Animations/parallax don't belong in settings
  - Users want efficiency, not entertainment
  - Save scroll effects for marketing pages
  - Source: [12 UI/UX Design Trends 2026](https://www.index.dev/blog/ui-ux-design-trends)

---

## Home/Team Management Pages

### Table Stakes (Must Have)

Core features required for household/team management in a recipe app context.

#### Invitation Flow
- **Email invitation with pending status** (Complexity: Medium)
  - Send invites to up to 5-6 family members
  - Show "pending" state while awaiting acceptance
  - Clear indication of who has accepted vs pending
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

- **Single email requirement** (Complexity: Low)
  - Recipient must sign up with the invited email
  - Clear messaging about this requirement
  - Error handling if emails don't match
  - Common pain point to address upfront
  - Source: [How to Make Shared Family Recipe Album](https://home.organizeat.com/how-to-make-a-shared-family-recipe-album-with-organizeat/)

- **Spam folder mitigation** (Complexity: Medium)
  - Warn users to check junk mail
  - Provide resend invitation option
  - Show confirmation when invitation sent
  - Source: [How to Make Shared Family Recipe Album](https://home.organizeat.com/how-to-make-a-shared-family-recipe-album-with-organizeat/)

#### Member Management
- **Member list with roles/status** (Complexity: Low)
  - Show all household members
  - Display role (admin, member, pending)
  - Easy to scan who has access
  - Source: [97 SaaS Invite Team Members UI Examples](https://www.saasframe.io/categories/invite-team-members)

- **Remove member capability** (Complexity: Medium)
  - Admin can remove members
  - Confirmation dialog for removal
  - Handle edge cases (last admin, etc.)
  - Source: [97 SaaS Invite Team Members UI Examples](https://www.saasframe.io/categories/invite-team-members)

- **Leave household option** (Complexity: Medium)
  - Members can leave on their own
  - Confirmation required
  - Different flow for admins (must transfer ownership or delete)
  - Source: [97 SaaS Invite Team Members UI Examples](https://www.saasframe.io/categories/invite-team-members)

#### Household Settings
- **Household name/identity** (Complexity: Low)
  - Name the household (e.g., "Stenberg Family")
  - Optional icon or color
  - Shows in navigation/header
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

- **Visibility controls** (Complexity: Medium)
  - Who can see recipes (household only vs public)
  - Who can add/edit/delete recipes
  - Clear permission model
  - Source: [Morsel Family Recipe App](https://getmorsel.com/)

#### Collaboration Features
- **Real-time sync indication** (Complexity: Medium)
  - Show when others are active
  - Optimistic updates for shared content
  - Handle conflicts gracefully
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

- **Shared access to all recipes** (Complexity: Low)
  - All household members see all recipes
  - Anyone can add recipes
  - Collaborative grocery lists and meal plans
  - Eliminates "what's for dinner" group chat
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

### Differentiators (Nice UX Touches)

Features that create delight for household recipe management.

#### Smart Invitations
- **Multi-email input** (Complexity: Medium)
  - Add multiple emails at once
  - Tag-style input with validation
  - Batch send invitations
  - Source: [97 SaaS Invite Team Members UI Examples](https://www.saasframe.io/categories/invite-team-members)

- **Invitation link sharing** (Complexity: Medium)
  - Generate shareable link as alternative to email
  - Link expires after time period or acceptance
  - Easier for families to share in group chats
  - Source: [97 SaaS Invite Team Members UI Examples](https://www.saasframe.io/categories/invite-team-members)

- **Role selection on invite** (Complexity: Medium)
  - Choose admin vs member when inviting
  - Dropdown or radio selection
  - Can edit roles after acceptance
  - Source: [97 SaaS Invite Team Members UI Examples](https://www.saasframe.io/categories/invite-team-members)

#### Member Experience
- **Activity indicators** (Complexity: High)
  - See who recently added/edited recipes
  - Attribution for contributions
  - Foster collaborative feeling
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

- **Member profiles/avatars** (Complexity: Medium)
  - Show who's who in household
  - Personal touch for family context
  - Helps identify recipe contributors
  - Source: [24 Best SaaS Team Pages](https://saaswebsites.com/page-categories/team-pages/)

- **Personal vs shared recipe separation** (Complexity: High)
  - Option to keep some recipes private
  - Default to shared for household
  - Flexibility for household dynamics
  - Source: [Morsel Family Recipe App](https://getmorsel.com/)

#### Onboarding & Growth
- **Gradual onboarding** (Complexity: Low)
  - Create account → Invite family → Upload recipes
  - Don't force immediate invitations
  - Let users explore first
  - Source: [Morsel Family Recipe App](https://getmorsel.com/)

- **Community expansion option** (Complexity: High)
  - Later feature: share beyond household
  - Public recipe sharing or friend networks
  - Start with household, grow to community
  - Source: [Morsel Family Recipe App](https://getmorsel.com/)

#### Communication
- **Recipe ideas and suggestions** (Complexity: High)
  - Users appreciate getting inspiration from others
  - Well-communicated through photos/videos
  - Social aspect enhances recipe sharing
  - Source: [Cooking Together Case Study](https://medium.com/@singhruchi1011/cooking-together-cooking-app-bfdc92bbfb71)

### Anti-Features (Things to Deliberately NOT Build)

Avoid these to keep household management simple and focused.

#### Complexity Creep
- **Complex permission matrices** (Complexity: N/A)
  - Don't build per-recipe permissions
  - Household = everyone sees everything (except optional private recipes)
  - Avoid enterprise-level access control
  - Keep it family-simple
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

- **Multi-household management** (Complexity: N/A)
  - Users belong to one household
  - Don't support juggling multiple households
  - Edge case that adds massive complexity
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

- **Detailed audit logs** (Complexity: N/A)
  - Not needed for family recipe app
  - Who edited what when is overkill
  - Light activity indicators are enough
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

#### Social Media Features
- **Likes, comments, reactions on recipes** (Complexity: N/A)
  - This isn't social media
  - Focus on utility, not engagement metrics
  - Family doesn't need to "like" mom's meatballs
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

- **News feed or activity stream** (Complexity: N/A)
  - Don't create a Facebook wall for recipes
  - Simple list of recipes is clearer
  - Avoid notification fatigue
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

#### Enterprise Patterns
- **Team hierarchy (departments, managers)** (Complexity: N/A)
  - Household has admins and members, that's it
  - No nested org charts needed
  - Keep it flat and family-friendly
  - Source: [97 SaaS Invite Team Members UI Examples](https://www.saasframe.io/categories/invite-team-members)

- **Billing per seat** (Complexity: N/A)
  - Household subscription covers all members
  - Don't charge per family member
  - Simple flat pricing for families
  - Source: [Recipe Sharing Apps](https://www.bublup.com/recipe-saving/)

- **Advanced dashboards** (Complexity: N/A)
  - Analytics on recipe usage is overkill
  - Families don't need engagement metrics
  - Keep it about cooking, not data
  - Source: [97 SaaS Invite Team Members UI Examples](https://www.saasframe.io/categories/invite-team-members)

---

## Summary: Design Principles for Matrummet

### Settings Page
**Do:**
- Use side navigation (240-300px) on the left
- Group into 3 clear sections: Profile, Security, API Keys
- Place danger zone (account deletion) at bottom with strong visual separation
- Provide immediate feedback on all changes
- Confirm destructive actions explicitly
- Keep design calm and minimalist

**Don't:**
- Nest settings more than 2-3 levels deep
- Create danger zones for non-critical actions
- Use tabs within settings sections
- Add settings nobody will customize

### Home Management Page
**Do:**
- Simple invitation flow via email (up to 5-6 members)
- Show pending vs accepted status clearly
- Allow member removal with confirmation
- Support household naming and basic settings
- Enable real-time sync for collaborative features
- Keep permissions simple (admin vs member)

**Don't:**
- Build complex per-recipe permissions
- Support multi-household memberships
- Add social media features (likes, feeds)
- Implement enterprise patterns (departments, per-seat billing)
- Create detailed audit logs

### Complexity Assessment
**Low complexity (quick wins):**
- Side navigation layout
- Visual hierarchy and grouping
- Member list display
- Household naming
- Basic confirmation dialogs

**Medium complexity (worth doing):**
- Email invitation flow with status tracking
- Real-time sync indicators
- Multi-email input for invitations
- Role selection and management
- Spam folder mitigation messaging

**High complexity (defer/skip for MVP):**
- Activity indicators and attribution
- Personal vs shared recipe separation
- Community expansion beyond household
- Advanced search within settings
- Recipe ideas and social suggestions

---

## Sources

- [NN/G: Left-Side Vertical Navigation on Desktop](https://www.nngroup.com/articles/vertical-nav/)
- [8 Settings Page UI Examples: Design Patterns That Work](https://bricxlabs.com/blogs/settings-page-ui-examples)
- [App Settings UI Design: Usability Tips & Best Practices](https://www.setproduct.com/blog/settings-ui-design)
- [Best UX Practices for Sidebar Menu Design in 2025](https://uiuxdesigntrends.com/best-ux-practices-for-sidebar-menu-in-2025/)
- [How to Manage Dangerous Actions In User Interfaces — Smashing Magazine](https://www.smashingmagazine.com/2024/09/how-manage-dangerous-actions-user-interfaces/)
- [Bitesized UX: Substack's Danger Zone](https://builtformars.com/ux-bites/highway-to-the-danger-zone)
- [12 UI/UX Design Trends That Will Dominate 2026](https://www.index.dev/blog/ui-ux-design-trends)
- [Tabs UX: Best Practices, Examples, and When to Avoid Them](https://www.eleken.co/blog-posts/tabs-ux)
- [Table Stakes Over Features: Why It's Important](https://thinkingthrough.substack.com/p/table-stakes-over-features-why-its)
- [Discovering the Table Stakes and Delighters | UX Booth](https://uxbooth.com/articles/discovering-table-stakes-delighters/)
- [Recipe Sharing Apps (Share With Friends & Family) - Bublup](https://www.bublup.com/recipe-saving/)
- [How to Make a Shared Family Recipe Album with OrganizEat](https://home.organizeat.com/how-to-make-a-shared-family-recipe-album-with-organizeat/)
- [97 SaaS Invite Team Members UI Design Examples in 2026](https://www.saasframe.io/categories/invite-team-members)
- [Morsel | A Family Recipe Cookbook Sharing App](https://getmorsel.com/)
- [Cooking Together — Cooking App UX Case Study](https://medium.com/@singhruchi1011/cooking-together-cooking-app-bfdc92bbfb71)
- [24 Best SaaS Team Pages - UI Examples](https://saaswebsites.com/page-categories/team-pages/)
