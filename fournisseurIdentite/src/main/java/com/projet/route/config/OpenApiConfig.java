package com.projet.route.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        final String bearerScheme = "bearerAuth";

        return new OpenAPI()
                // Relative server URL keeps Swagger usable on any host/IP without manual edits.
                .addServersItem(new Server().url("/").description("Current server"))
                .info(new Info()
                        .title("RouteWatch API")
                        .version("1.1")
                        .description("API de gestion des signalements, travaux, synchronisation et analytics"))
                .components(new Components()
                        .addSecuritySchemes(
                                bearerScheme,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("JWT token. Exemple: Bearer <token>")))
                .addSecurityItem(new SecurityRequirement().addList(bearerScheme));
    }
}
