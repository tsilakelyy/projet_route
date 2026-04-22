# Etape 1 : Build
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
ENV MAVEN_OPTS="-Xms128m -Xmx512m -XX:+UseSerialGC"

# Copier d'abord pom.xml pour exploiter le cache Docker
COPY pom.xml ./
RUN bash -ec 'for i in 1 2 3 4 5; do \
  mvn -B -ntp -T 1 \
  -Dmaven.wagon.http.retryHandler.count=10 \
  -Dmaven.wagon.rto=120000 \
  -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 \
  dependency:go-offline && exit 0; \
  echo "Maven go-offline failed (attempt $i/5), retrying..."; \
  if [ $i -eq 5 ]; then \
    echo "Cleaning corrupted Maven cache..."; \
    rm -rf /root/.m2/repository/*; \
  fi; \
  sleep $((i * 5)); \
done; \
exit 1'

# Copier le code source et compiler
COPY src ./src
RUN bash -ec 'for i in 1 2 3 4 5; do \
  mvn -B -ntp -T 1 -DskipTests \
  -Dmaven.wagon.http.retryHandler.count=10 \
  -Dmaven.wagon.rto=120000 \
  -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 \
  -U \
  package && exit 0; \
  echo "Maven package failed (attempt $i/5), retrying..."; \
  if [ $i -eq 5 ]; then \
    echo "Cleaning corrupted Maven cache due to persistent failures..."; \
    rm -rf /root/.m2/repository/*; \
    echo "Retrying with clean cache..."; \
    mvn -B -ntp -T 1 -DskipTests dependency:go-offline && \
    mvn -B -ntp -T 1 -DskipTests package && exit 0; \
    echo "Maven package still failing after cache cleanup."; \
    exit 1; \
  fi; \
  sleep $((i * 5)); \
done; \
exit 1'

# Etape 2 : Run
FROM eclipse-temurin:17-jdk
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8082

ENTRYPOINT ["java", "-Dspring.profiles.active=docker", "-jar", "app.jar"]
