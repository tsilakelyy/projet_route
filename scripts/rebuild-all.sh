#!/bin/bash

# Script d'auto-réparation complet
# Nettoie tous les dossiers volumineux et les reconstruit via Docker

echo "🧹 Nettoyage complet du projet..."
echo "=================================="
echo ""

# Nettoyer les dossiers volumineux
echo "🗑️  Suppression des dossiers de build..."
rm -rf mobile/node_modules mobile/dist mobile/android/app/build
rm -rf crypto/node_modules 
rm -rf front-crypto/node_modules front-crypto/dist
rm -rf fournisseurIdentite/target

echo "✅ Nettoyage terminé"
echo ""

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé"
    exit 1
fi

if ! docker compose --version &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé"
    exit 1
fi

echo "🐳 Compilation Docker complète..."
echo "===================================="
echo ""

cd "$(dirname "$0")"

# Build tous les services
if docker compose build; then
    echo ""
    echo "✅ Build Docker réussi!"
    echo ""
    echo "📊 État des images:"
    docker image ls projet_route*
    echo ""
    echo "🚀 Pour lancer les services:"
    echo "   docker compose up"
else
    echo "❌ Build Docker échoué"
    exit 1
fi
