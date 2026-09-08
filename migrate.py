import re
import os

files = [
    r'c:\Users\Hp\OneDrive\Desktop\sih\medcheck\src\pages\PatientDashboard.jsx',
    r'c:\Users\Hp\OneDrive\Desktop\sih\medcheck\src\pages\PatientProfile.jsx'
]

# Mapping of classNames to replace
class_map = {
    'className="dashboard"': 'className="min-h-screen bg-transparent text-[#171d1b]"',
    'className="topbar"': 'className="h-[88px] flex items-center justify-between px-4 md:px-16 py-6 bg-transparent border-b border-[rgba(41,87,75,0.12)]"',
    'className="brand"': 'className="text-[#29574b] font-bold text-3xl font-serif"',
    'className="dashboard-body"': 'className="flex flex-col md:flex-row min-h-[calc(100vh-88px)]"',
    'className="sidebar"': 'className="hidden md:flex flex-col w-72 shrink-0 min-h-[calc(100vh-88px)] p-6 gap-8 bg-transparent border-r border-[rgba(41,87,75,0.12)]"',
    'className="side-links"': 'className="grid gap-2"',
    # For side-links a, it is dynamically generated so we will handle inline
    'className="dashboard-main"': 'className="w-full max-w-5xl px-4 md:px-16 py-8 md:py-12 mx-auto"',
    'className="dashboard-assistant"': 'className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white bg-[#29574b] font-semibold text-base"',
    'className="dashboard-notifications"': 'className="relative grid place-items-center w-8 h-10 p-2 rounded-full bg-transparent"',
    'className="dashboard-profile"': 'className="flex items-center gap-3 pl-2 border-l border-[rgba(41,87,75,0.2)] text-[#171d1b] text-sm font-semibold"',
    'className="profile-dashboard-shell"': 'className="min-h-screen bg-transparent text-[#171d1b] font-[Manrope,sans-serif]"',
    'className="profile-dashboard-body"': 'className="flex flex-col md:flex-row min-h-[calc(100vh-88px)]"',
    'className="profile-workspace"': 'className="flex-1 min-w-0 w-full max-w-6xl px-4 md:px-16 py-8 md:py-10 mx-auto"',
    'className="metric-card"': 'className="min-h-[286px] flex flex-col justify-between p-8 bg-white/80 rounded-3xl border border-[rgba(222,228,224,0.85)] shadow-lg backdrop-blur-sm"',
    'className="health-grid"': 'className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 mt-8"',
    'className="metrics-grid"': 'className="grid grid-cols-1 sm:grid-cols-2 gap-8"',
    'className="timeline"': 'className="mt-8 p-8 bg-white/85 rounded-3xl border border-[rgba(222,228,224,0.85)] shadow-lg"',
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Replace static classNames
    for old, new in class_map.items():
        content = content.replace(old, new)
        
    # Special replacements for active link
    content = content.replace(
        "className={isActive ? 'active' : ''}", 
        "className={`flex items-center gap-4 px-4 py-3 rounded-full text-sm font-semibold ${isActive ? 'text-[#29574b] font-bold bg-[rgba(41,87,75,0.1)]' : 'text-[#404845] hover:bg-[rgba(41,87,75,0.06)]'}`}"
    )
    
    # Replace style={{...}} blocks with tailwind equivalent where possible or keep it minimal
    # For a full migration, writing a heuristic converter:
    
    style_regex = re.compile(r'style=\{\{\s*([^}]+)\s*\}\}')
    
    def style_replacer(match):
        style_str = match.group(1)
        classes = []
        
        # Simple mappings
        mappings = [
            (r"display:\s*'flex'", 'flex'),
            (r"display:\s*'grid'", 'grid'),
            (r"flexDirection:\s*'column'", 'flex-col'),
            (r"alignItems:\s*'center'", 'items-center'),
            (r"alignItems:\s*'baseline'", 'items-baseline'),
            (r"justifyContent:\s*'space-between'", 'justify-between'),
            (r"justifyContent:\s*'center'", 'justify-center'),
            (r"justifyContent:\s*'space-around'", 'justify-around'),
            (r"flexWrap:\s*'wrap'", 'flex-wrap'),
            (r"gap:\s*'(\d+)px'", lambda m: f"gap-[{m.group(1)}px]"),
            (r"padding:\s*'([^']+)'", lambda m: f"p-[{m.group(1).replace(' ', '_')}]"),
            (r"paddingBottom:\s*'([^']+)'", lambda m: f"pb-[{m.group(1)}]"),
            (r"paddingTop:\s*'([^']+)'", lambda m: f"pt-[{m.group(1)}]"),
            (r"margin:\s*'([^']+)'", lambda m: f"m-[{m.group(1).replace(' ', '_')}]"),
            (r"marginTop:\s*'([^']+)'", lambda m: f"mt-[{m.group(1)}]"),
            (r"marginBottom:\s*'([^']+)'", lambda m: f"mb-[{m.group(1)}]"),
            (r"borderRadius:\s*'([^']+)'", lambda m: f"rounded-[{m.group(1)}]"),
            (r"background:\s*'([^']+)'", lambda m: f"bg-[{m.group(1).replace(' ', '_')}]"),
            (r"color:\s*'([^']+)'", lambda m: f"text-[{m.group(1)}]"),
            (r"fontSize:\s*'([^']+)'", lambda m: f"text-[{m.group(1)}]"),
            (r"fontWeight:\s*'?(\d+|bold)'?", lambda m: f"font-[{m.group(1)}]"),
            (r"border:\s*'?0'?", 'border-0'),
            (r"border:\s*'none'", 'border-0'),
            (r"border:\s*'([^']+)'", lambda m: f"border-[{m.group(1).replace(' ', '_')}]"),
            (r"borderBottom:\s*'([^']+)'", lambda m: f"border-b-[{m.group(1).replace(' ', '_')}]"),
            (r"borderTop:\s*'([^']+)'", lambda m: f"border-t-[{m.group(1).replace(' ', '_')}]"),
            (r"borderLeft:\s*'([^']+)'", lambda m: f"border-l-[{m.group(1).replace(' ', '_')}]"),
            (r"boxShadow:\s*'([^']+)'", lambda m: f"shadow-[{m.group(1).replace(' ', '_')}]"),
            (r"width:\s*'([^']+)'", lambda m: f"w-[{m.group(1)}]"),
            (r"height:\s*'([^']+)'", lambda m: f"h-[{m.group(1)}]"),
            (r"minWidth:\s*'([^']+)'", lambda m: f"min-w-[{m.group(1)}]"),
            (r"flexShrink:\s*0", 'shrink-0'),
            (r"flex:\s*1", 'flex-1'),
            (r"cursor:\s*'pointer'", 'cursor-pointer'),
            (r"textAlign:\s*'center'", 'text-center'),
            (r"textTransform:\s*'capitalize'", 'capitalize'),
            (r"textTransform:\s*'uppercase'", 'uppercase'),
            (r"letterSpacing:\s*'([^']+)'", lambda m: f"tracking-[{m.group(1)}]"),
            (r"whiteSpace:\s*'nowrap'", 'whitespace-nowrap'),
            (r"position:\s*'relative'", 'relative'),
            (r"position:\s*'absolute'", 'absolute'),
            (r"position:\s*'fixed'", 'fixed'),
            (r"inset:\s*0", 'inset-0'),
            (r"zIndex:\s*(\d+)", lambda m: f"z-[{m.group(1)}]"),
            (r"lineHeight:\s*([\d.]+)", lambda m: f"leading-[{m.group(1)}]"),
            (r"fontStyle:\s*'normal'", 'not-italic'),
            (r"textDecoration:\s*'none'", 'no-underline'),
            (r"display:\s*'block'", 'block'),
            (r"overflow:\s*'hidden'", 'overflow-hidden'),
            (r"backdropFilter:\s*'([^']+)'", lambda m: f"backdrop-filter-[{m.group(1).replace(' ', '_')}]"),
            (r"placeItems:\s*'center'", 'place-items-center'),
            (r"font:\s*[\"']([^\"']+)[\"']", lambda m: f"font-[{m.group(1).replace(' ', '_')}]"),
        ]
        
        remaining_styles = []
        parts = [p.strip() for p in style_str.split(',') if p.strip()]
        
        for p in parts:
            matched = False
            for pattern, repl in mappings:
                if re.match(pattern, p):
                    if callable(repl):
                        classes.append(repl(re.match(pattern, p)))
                    else:
                        classes.append(repl)
                    matched = True
                    break
            if not matched:
                remaining_styles.append(p)
                
        if len(classes) > 0 and len(remaining_styles) == 0:
            return f'className="{ " ".join(classes) }"'
        elif len(classes) > 0:
            return f'className="{ " ".join(classes) }" style={{{{ {", ".join(remaining_styles)} }}}}'
        else:
            return match.group(0)

    # Note: we need to handle cases where there is already a className!
    # For example: className="brand" style={{...}}
    # We can do this in two passes or using regex.
    # Actually, if we just convert `style={{...}}` to `className="..."` it might result in two classNames.
    # In React, you can't have two className props. 
    # Let's do a more careful replacement. 
    pass

    # A simpler approach: replace the specific known classNames + style in the files entirely with regex
    
    # Run the generic replacements
    content = re.sub(style_regex, style_replacer, content)
    
    # Merge double classNames: className="foo" className="bar" -> className="foo bar"
    # Repeatedly merge until no more
    while True:
        new_content = re.sub(r'className="([^"]+)"\s+className="([^"]+)"', r'className="\1 \2"', content)
        if new_content == content:
            break
        content = new_content
        
    while True:
        new_content = re.sub(r"className=\{`([^`]+)`\}\s+className=\"([^\"]+)\"", r"className={`\1 \2`}", content)
        if new_content == content:
            break
        content = new_content
        
    while True:
        new_content = re.sub(r"className=\"([^\"]+)\"\s+className=\{`([^`]+)`\}", r"className={`\1 \2`}", content)
        if new_content == content:
            break
        content = new_content
        
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for fp in files:
    process_file(fp)

print("Migration completed.")
