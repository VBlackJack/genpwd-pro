package com.julien.genpwdpro.di

import android.content.Context
import com.julien.genpwdpro.domain.generators.LeetSpeakGenerator
import com.julien.genpwdpro.domain.generators.PassphraseGenerator
import com.julien.genpwdpro.domain.generators.SyllablesGenerator
import com.julien.genpwdpro.domain.usecases.ApplyCasingUseCase
import com.julien.genpwdpro.domain.usecases.GeneratePasswordUseCase
import com.julien.genpwdpro.domain.usecases.PlaceCharactersUseCase
import com.julien.genpwdpro.domain.utils.DictionaryManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Module Hilt pour l'injection de dépendances de l'application
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDictionaryManager(
        @ApplicationContext context: Context
    ): DictionaryManager {
        return DictionaryManager(context)
    }

    @Provides
    @Singleton
    fun provideSyllablesGenerator(): SyllablesGenerator {
        return SyllablesGenerator()
    }

    @Provides
    @Singleton
    fun providePassphraseGenerator(
        dictionaryManager: DictionaryManager
    ): PassphraseGenerator {
        return PassphraseGenerator(dictionaryManager)
    }

    @Provides
    @Singleton
    fun provideLeetSpeakGenerator(): LeetSpeakGenerator {
        return LeetSpeakGenerator()
    }

    @Provides
    @Singleton
    fun provideApplyCasingUseCase(): ApplyCasingUseCase {
        return ApplyCasingUseCase()
    }

    @Provides
    @Singleton
    fun providePlaceCharactersUseCase(): PlaceCharactersUseCase {
        return PlaceCharactersUseCase()
    }

    @Provides
    @Singleton
    fun provideGeneratePasswordUseCase(
        syllablesGenerator: SyllablesGenerator,
        passphraseGenerator: PassphraseGenerator,
        leetSpeakGenerator: LeetSpeakGenerator,
        applyCasingUseCase: ApplyCasingUseCase,
        placeCharactersUseCase: PlaceCharactersUseCase
    ): GeneratePasswordUseCase {
        return GeneratePasswordUseCase(
            syllablesGenerator,
            passphraseGenerator,
            leetSpeakGenerator,
            applyCasingUseCase,
            placeCharactersUseCase
        )
    }
}
