#!/usr/bin/env python3
"""
Script pour extraire et afficher la structure complète du projet BanqueApp-NTiers
Place ce fichier à la racine du projet et exécute: python extract_structure.py
"""

import os
import sys
from pathlib import Path

# Extensions de fichiers à ignorer
IGNORE_DIRS = {
    '.git', '.idea', '.vscode', '__pycache__', 'node_modules', 
    '.settings', 'bin', 'obj', '.vs'
}

IGNORE_FILES = {
    '.DS_Store', 'Thumbs.db', '.gitignore', '.gitkeep'
}

# Extensions à afficher avec des annotations
FILE_ANNOTATIONS = {
    '.java': '',
    '.jsp': '',
    '.xml': '',
    '.properties': '',
    '.sql': '',
    '.md': '',
    '.html': '',
    '.css': '',
    '.js': '',
    '.cs': '',
    '.csproj': '',
    '.bat': '',
    '.sh': '',
    '.json': '',
    '.yaml': '',
    '.yml': '',
}

def get_tree_chars(is_last, is_root=False):
    """Retourne les caractères pour l'arborescence"""
    if is_root:
        return ""
    return "└── " if is_last else "├── "

def get_prefix(depth, is_last_list):
    """Génère le préfixe pour l'indentation"""
    if depth == 0:
        return ""
    
    prefix = ""
    for i in range(depth - 1):
        prefix += "│   " if not is_last_list[i] else "    "
    return prefix

def should_ignore(name, is_dir):
    """Vérifie si un fichier/dossier doit être ignoré"""
    if is_dir:
        return name in IGNORE_DIRS or name.startswith('.')
    return name in IGNORE_FILES

def get_file_info(file_path):
    """Retourne des informations sur le fichier"""
    ext = file_path.suffix.lower()
    annotation = FILE_ANNOTATIONS.get(ext, '')
    
    # Annotations spéciales pour certains fichiers
    if file_path.name == 'pom.xml':
        annotation = ' (Maven)'
    elif file_path.name == 'persistence.xml':
        annotation = ' (JPA Config)'
    elif file_path.name == 'web.xml':
        annotation = ' (Web Config)'
    elif file_path.name == 'glassfish-resources.xml':
        annotation = ' (JDBC Resources)'
    elif 'SessionBean' in file_path.name:
        if 'Stateless' in open(file_path, 'r', encoding='utf-8', errors='ignore').read():
            annotation = ' (Stateless EJB)'
        elif 'Stateful' in open(file_path, 'r', encoding='utf-8', errors='ignore').read():
            annotation = ' (Stateful EJB)'
        elif 'Singleton' in open(file_path, 'r', encoding='utf-8', errors='ignore').read():
            annotation = ' (Singleton EJB)'
    
    return annotation

def count_items(path):
    """Compte le nombre de fichiers et dossiers"""
    try:
        items = list(path.iterdir())
        return len([i for i in items if not should_ignore(i.name, i.is_dir())])
    except PermissionError:
        return 0

def print_tree(path, depth=0, is_last_list=None, prefix="", output_file=None):
    """Affiche l'arborescence du projet de manière récursive"""
    if is_last_list is None:
        is_last_list = []
    
    try:
        items = sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
        items = [i for i in items if not should_ignore(i.name, i.is_dir())]
        
        for idx, item in enumerate(items):
            is_last = (idx == len(items) - 1)
            
            # Construire la ligne
            tree_char = get_tree_chars(is_last, depth == 0)
            line_prefix = get_prefix(depth, is_last_list)
            
            if item.is_dir():
                # Affichage pour les dossiers
                dir_name = f"{item.name}/"
                line = f"{line_prefix}{tree_char}{dir_name}"
                print(line)
                if output_file:
                    output_file.write(line + "\n")
                
                # Récursion
                new_is_last_list = is_last_list + [is_last]
                print_tree(item, depth + 1, new_is_last_list, prefix, output_file)
            else:
                # Affichage pour les fichiers
                try:
                    file_info = get_file_info(item)
                    file_size = item.stat().st_size
                    size_info = ""
                    
                    if file_size == 0:
                        size_info = " [VIDE]"
                    elif file_size < 1024:
                        size_info = f" ({file_size}B)"
                    elif file_size < 1024 * 1024:
                        size_info = f" ({file_size // 1024}KB)"
                    else:
                        size_info = f" ({file_size // (1024 * 1024)}MB)"
                    
                    line = f"{line_prefix}{tree_char}{item.name}{file_info}{size_info}"
                    print(line)
                    if output_file:
                        output_file.write(line + "\n")
                except Exception as e:
                    line = f"{line_prefix}{tree_char}{item.name} [ERREUR: {e}]"
                    print(line)
                    if output_file:
                        output_file.write(line + "\n")
    
    except PermissionError:
        pass

def analyze_project(root_path):
    """Analyse le projet et affiche des statistiques"""
    stats = {
        'java': 0, 'xml': 0, 'jsp': 0, 'html': 0, 'css': 0, 
        'js': 0, 'sql': 0, 'cs': 0, 'empty': 0, 'total': 0
    }
    
    for root, dirs, files in os.walk(root_path):
        # Filtrer les dossiers à ignorer
        dirs[:] = [d for d in dirs if not should_ignore(d, True)]
        
        for file in files:
            if should_ignore(file, False):
                continue
            
            file_path = Path(root) / file
            stats['total'] += 1
            
            # Vérifier si vide
            try:
                if file_path.stat().st_size == 0:
                    stats['empty'] += 1
            except:
                pass
            
            # Compter par extension
            ext = file_path.suffix.lower()
            if ext == '.java':
                stats['java'] += 1
            elif ext == '.xml':
                stats['xml'] += 1
            elif ext == '.jsp':
                stats['jsp'] += 1
            elif ext in ['.html', '.htm']:
                stats['html'] += 1
            elif ext == '.css':
                stats['css'] += 1
            elif ext == '.js':
                stats['js'] += 1
            elif ext == '.sql':
                stats['sql'] += 1
            elif ext == '.cs':
                stats['cs'] += 1
    
    return stats

def main():
    """Fonction principale"""
    # Déterminer le répertoire racine
    if len(sys.argv) > 1:
        root_path = Path(sys.argv[1])
    else:
        root_path = Path.cwd()
    
    if not root_path.exists():
        print(f"ERREUR: Le chemin {root_path} n'existe pas!")
        sys.exit(1)
    
    print("=" * 80)
    print(f"   STRUCTURE DU PROJET: {root_path.name}")
    print("=" * 80)
    print()
    
    # Ouvrir un fichier de sortie
    output_path = root_path / "project_structure.txt"
    with open(output_path, 'w', encoding='utf-8') as output_file:
        output_file.write("=" * 80 + "\n")
        output_file.write(f"   STRUCTURE DU PROJET: {root_path.name}\n")
        output_file.write("=" * 80 + "\n\n")
        
        # Afficher l'arborescence
        print(f"{root_path.name}/")
        output_file.write(f"{root_path.name}/\n")
        print_tree(root_path, output_file=output_file)
    
    print()
    print("=" * 80)
    print("   STATISTIQUES DU PROJET")
    print("=" * 80)
    
    stats = analyze_project(root_path)
    
    print(f"Fichiers Java (.java)      : {stats['java']}")
    print(f"Fichiers XML (.xml)        : {stats['xml']}")
    print(f"Fichiers JSP (.jsp)        : {stats['jsp']}")
    print(f"Fichiers HTML (.html)      : {stats['html']}")
    print(f"Fichiers CSS (.css)        : {stats['css']}")
    print(f"Fichiers JavaScript (.js)  : {stats['js']}")
    print(f"Fichiers SQL (.sql)        : {stats['sql']}")
    print(f"Fichiers C# (.cs)          : {stats['cs']}")
    print(f"Fichiers VIDES             : {stats['empty']}")
    print(f"TOTAL de fichiers          : {stats['total']}")
    
    print()
    print(f"✅ Structure sauvegardée dans: {output_path}")
    print()
    
    # Avertissement si beaucoup de fichiers vides
    if stats['empty'] > 10:
        print("⚠️  ATTENTION: Beaucoup de fichiers sont VIDES!")
        print("   Le projet semble incomplet. Vérifie que tu as bien:")
        print("   1. Tous les fichiers .java (entities, beans, servlets, etc.)")
        print("   2. Les fichiers JSP pour l'interface web")
        print("   3. Les fichiers de configuration")

if __name__ == "__main__":
    main()